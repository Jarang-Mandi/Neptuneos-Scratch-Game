import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Daily login reward points
const DAILY_LOGIN_POINTS = 2
const COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

const redis = Redis.fromEnv()

// Rate limiter: 5 requests per minute per wallet
const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    analytics: true,
})

// Wallet address validation
function isValidWallet(wallet: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(wallet)
}

// GET: Check daily login status
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
        const lastLogin = Number(existing?.lastDailyLogin || 0)
        const now = Date.now()

        const canClaim = (now - lastLogin) >= COOLDOWN_MS
        const nextClaimTime = lastLogin + COOLDOWN_MS
        const totalDailyLoginPoints = Number(existing?.dailyLoginPoints || 0)

        return NextResponse.json({
            canClaim,
            lastClaimTime: lastLogin,
            nextClaimTime: canClaim ? now : nextClaimTime,
            cooldownRemaining: canClaim ? 0 : nextClaimTime - now,
            totalDailyLoginPoints,
            pointsPerClaim: DAILY_LOGIN_POINTS
        })
    } catch (error) {
        console.error('Daily login GET error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}

// POST: Claim daily login reward
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { wallet } = body

        if (!wallet || !isValidWallet(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()

        // Rate limit
        const { success } = await ratelimit.limit(`daily-login:${walletLower}`)
        if (!success) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
        }

        const key = `player:${walletLower}`
        const now = Date.now()

        // Get existing data
        const existing = await redis.hgetall(key)
        const lastLogin = Number(existing?.lastDailyLogin || 0)

        // Check cooldown (24 hours)
        if ((now - lastLogin) < COOLDOWN_MS) {
            const nextClaimTime = lastLogin + COOLDOWN_MS
            return NextResponse.json({
                success: false,
                error: 'Already claimed today! Come back later.',
                nextClaimTime,
                cooldownRemaining: nextClaimTime - now
            }, { status: 400 })
        }

        // Award points
        const currentPoints = Number(existing?.dailyLoginPoints || 0)
        const newPoints = currentPoints + DAILY_LOGIN_POINTS

        // Update Redis
        await redis.hset(key, {
            lastDailyLogin: now,
            dailyLoginPoints: newPoints,
            wallet: walletLower
        })

        return NextResponse.json({
            success: true,
            pointsEarned: DAILY_LOGIN_POINTS,
            totalDailyLoginPoints: newPoints,
            nextClaimTime: now + COOLDOWN_MS,
            message: `+${DAILY_LOGIN_POINTS} points claimed!`
        })
    } catch (error) {
        console.error('Daily login POST error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
