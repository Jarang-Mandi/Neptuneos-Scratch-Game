import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { verifyAuthForWallet } from '@/lib/auth'
import crypto from 'crypto'

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

// Generate unique referral code from wallet (crypto-safe randomness)
function generateReferralCode(wallet: string): string {
    const walletPart = wallet.slice(-6).toUpperCase()
    const randomPart = crypto.randomBytes(3).toString('hex').slice(0, 4).toUpperCase()
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

        // Verify session auth — only wallet owner can use referral
        const auth = verifyAuthForWallet(request, wallet)
        if (!auth.authenticated) {
            return NextResponse.json({ error: auth.error }, { status: 401 })
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

        /**
         * Lua script: atomic referral registration across TWO player keys.
         * Re-checks referredBy + referralCount inside the script to prevent
         * TOCTOU races (the earlier checks are fast-fail only).
         */
        const REFERRAL_LUA = `
local refereeKey = KEYS[1]
local referrerKey = KEYS[2]
local referrerWallet = ARGV[1]
local maxReferrals = tonumber(ARGV[2])

local referredBy = redis.call('HGET', refereeKey, 'referredBy')
if referredBy and referredBy ~= '' then
  return 'ALREADY_REFERRED'
end

local referralCount = tonumber(redis.call('HGET', referrerKey, 'referralCount')) or 0
if referralCount >= maxReferrals then
  return 'MAX_REFERRALS'
end

redis.call('HSET', refereeKey, 'referredBy', referrerWallet)
redis.call('HSET', referrerKey, 'referralCount', referralCount + 1)

return 'OK:' .. (referralCount + 1)
`

        const result = await redis.eval(
            REFERRAL_LUA,
            [refereeKey, referrerKey],
            [String(referrerWallet).toLowerCase(), MAX_REFERRALS]
        ) as string

        const resultStr = String(result)

        if (resultStr === 'ALREADY_REFERRED') {
            return NextResponse.json({
                success: false,
                error: 'You have already been referred!'
            }, { status: 400 })
        }

        if (resultStr === 'MAX_REFERRALS') {
            return NextResponse.json({
                success: false,
                error: 'Referrer has reached maximum referrals'
            }, { status: 400 })
        }

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
