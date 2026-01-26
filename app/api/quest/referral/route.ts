import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Referral constants
const REFERRAL_POINTS = 10
const MAX_REFERRALS = 50
const MIN_WINS_FOR_VALID_REFERRAL = 5

const redis = Redis.fromEnv()

// Rate limiter
const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    analytics: true,
})

// Wallet address validation
function isValidWallet(wallet: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(wallet)
}

// Generate unique referral code from wallet
function generateReferralCode(wallet: string): string {
    // Use last 8 chars of wallet + random 4 chars
    const walletPart = wallet.slice(-6).toUpperCase()
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase()
    return `${walletPart}${randomPart}`
}

// GET: Get referral info for a wallet
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const wallet = searchParams.get('wallet')

        if (!wallet || !isValidWallet(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()
        const key = `player:${walletLower}`

        const existing = await redis.hgetall(key)
        let referralCode = String(existing?.referralCode || '')

        // Generate code if doesn't exist
        if (!referralCode) {
            referralCode = generateReferralCode(walletLower)
            await redis.hset(key, {
                referralCode,
                wallet: walletLower
            })
            // Also store reverse mapping for lookup
            await redis.set(`referral:${referralCode}`, walletLower)
        }

        const referralCount = Number(existing?.referralCount || 0)
        const referralPoints = referralCount * REFERRAL_POINTS

        return NextResponse.json({
            referralCode,
            referralCount,
            referralPoints,
            maxReferrals: MAX_REFERRALS,
            pointsPerReferral: REFERRAL_POINTS,
            referralsRemaining: MAX_REFERRALS - referralCount,
            shareUrl: `https://neptuneos-scratch-game.vercel.app?ref=${referralCode}`
        })
    } catch (error) {
        console.error('Referral GET error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}

// POST: Register a referral
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { wallet, referralCode } = body

        if (!wallet || !isValidWallet(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
        }

        if (!referralCode || typeof referralCode !== 'string') {
            return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()
        const codeUpper = referralCode.toUpperCase()

        // Rate limit
        const { success } = await ratelimit.limit(`referral:${walletLower}`)
        if (!success) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
        }

        const refereeKey = `player:${walletLower}`

        // Check if referee already has a referrer
        const refereeData = await redis.hgetall(refereeKey)
        if (refereeData?.referredBy) {
            return NextResponse.json({
                success: false,
                error: 'You have already been referred!'
            }, { status: 400 })
        }

        // Find referrer by code
        const referrerWallet = await redis.get(`referral:${codeUpper}`)
        if (!referrerWallet) {
            return NextResponse.json({
                success: false,
                error: 'Invalid referral code'
            }, { status: 400 })
        }

        // Prevent self-referral
        if (String(referrerWallet).toLowerCase() === walletLower) {
            return NextResponse.json({
                success: false,
                error: 'Cannot refer yourself!'
            }, { status: 400 })
        }

        const referrerKey = `player:${String(referrerWallet).toLowerCase()}`
        const referrerData = await redis.hgetall(referrerKey)

        // Check referrer hasn't exceeded max referrals
        const currentReferrals = Number(referrerData?.referralCount || 0)
        if (currentReferrals >= MAX_REFERRALS) {
            return NextResponse.json({
                success: false,
                error: 'Referrer has reached maximum referrals'
            }, { status: 400 })
        }

        // Check referee has minimum wins (anti-abuse)
        const refereeWins = Number(refereeData?.easyWins || 0) +
            Number(refereeData?.mediumWins || 0) +
            Number(refereeData?.hardWins || 0)

        if (refereeWins < MIN_WINS_FOR_VALID_REFERRAL) {
            return NextResponse.json({
                success: false,
                error: `You need at least ${MIN_WINS_FOR_VALID_REFERRAL} wins to use a referral code!`,
                currentWins: refereeWins,
                winsNeeded: MIN_WINS_FOR_VALID_REFERRAL - refereeWins
            }, { status: 400 })
        }

        // Register referral
        // 1. Mark referee as referred
        await redis.hset(refereeKey, {
            referredBy: String(referrerWallet).toLowerCase(),
            wallet: walletLower
        })

        // 2. Increment referrer's count
        await redis.hset(referrerKey, {
            referralCount: currentReferrals + 1
        })

        return NextResponse.json({
            success: true,
            message: 'Referral registered successfully!',
            pointsAwarded: REFERRAL_POINTS,
            referrerRewardPending: true
        })
    } catch (error) {
        console.error('Referral POST error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
