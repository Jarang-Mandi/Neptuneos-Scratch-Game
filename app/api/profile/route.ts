import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Point values
const LEVEL_POINTS = { easy: 3, medium: 5, hard: 10 }
const DAILY_LOGIN_POINTS = 2
const SUPPORTER_BONUS_POINTS = 50
const REFERRAL_POINTS = 10

const redis = Redis.fromEnv()

const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '60 s'),
    analytics: true,
})

function isValidWallet(wallet: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(wallet)
}

// GET: Get full profile data with points breakdown
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const wallet = searchParams.get('wallet')

        if (!wallet || !isValidWallet(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()

        // Rate limit
        const { success } = await ratelimit.limit(`profile:${walletLower}`)
        if (!success) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
        }

        const key = `player:${walletLower}`
        const data = await redis.hgetall(key)

        if (!data) {
            return NextResponse.json({
                wallet: walletLower,
                exists: false,
                points: {
                    game: 0,
                    dailyLogin: 0,
                    supporter: 0,
                    referral: 0,
                    total: 0
                },
                stats: {
                    easyWins: 0,
                    mediumWins: 0,
                    hardWins: 0,
                    totalWins: 0
                },
                referral: {
                    code: null,
                    count: 0,
                    maxReferrals: 50
                },
                isSupporter: false,
                dailyWinsRemaining: 10
            })
        }

        // Calculate points
        const easyWins = Number(data.easyWins || 0)
        const mediumWins = Number(data.mediumWins || 0)
        const hardWins = Number(data.hardWins || 0)

        const gamePoints = (easyWins * LEVEL_POINTS.easy) +
            (mediumWins * LEVEL_POINTS.medium) +
            (hardWins * LEVEL_POINTS.hard)

        const dailyLoginPoints = Number(data.dailyLoginPoints || 0)
        const isSupporter = Boolean(data.isSupporter)
        const supporterBonusClaimed = Boolean(data.supporterBonusClaimed)
        const supporterPoints = supporterBonusClaimed ? SUPPORTER_BONUS_POINTS : 0

        const referralCount = Number(data.referralCount || 0)
        const referralPoints = referralCount * REFERRAL_POINTS

        const totalPoints = gamePoints + dailyLoginPoints + supporterPoints + referralPoints

        // Daily wins info
        const today = new Date().toISOString().split('T')[0]
        const dailyWinDate = String(data.dailyWinDate || '')
        const dailyWinCount = dailyWinDate === today ? Number(data.dailyWinCount || 0) : 0

        return NextResponse.json({
            wallet: walletLower,
            exists: true,
            points: {
                game: gamePoints,
                dailyLogin: dailyLoginPoints,
                supporter: supporterPoints,
                referral: referralPoints,
                total: totalPoints
            },
            stats: {
                easyWins,
                mediumWins,
                hardWins,
                totalWins: easyWins + mediumWins + hardWins
            },
            referral: {
                code: data.referralCode || null,
                count: referralCount,
                maxReferrals: 50,
                referredBy: data.referredBy || null
            },
            isSupporter,
            supporterBonusClaimed,
            canClaimSupporterBonus: isSupporter && !supporterBonusClaimed,
            dailyWinsRemaining: 10 - dailyWinCount,
            dailyWinCount
        })
    } catch (error) {
        console.error('Profile GET error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}

// POST: Claim supporter bonus (one-time 50 points)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { wallet, action } = body

        if (!wallet || !isValidWallet(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()
        const key = `player:${walletLower}`

        if (action === 'claim_supporter_bonus') {
            const data = await redis.hgetall(key)

            // Check if supporter
            if (!data?.isSupporter) {
                return NextResponse.json({
                    success: false,
                    error: 'You must be a supporter to claim this bonus!'
                }, { status: 400 })
            }

            // Check if already claimed
            if (data?.supporterBonusClaimed) {
                return NextResponse.json({
                    success: false,
                    error: 'Supporter bonus already claimed!'
                }, { status: 400 })
            }

            // Claim bonus
            await redis.hset(key, { supporterBonusClaimed: true })

            return NextResponse.json({
                success: true,
                pointsEarned: SUPPORTER_BONUS_POINTS,
                message: `+${SUPPORTER_BONUS_POINTS} supporter bonus claimed!`
            })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (error) {
        console.error('Profile POST error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
