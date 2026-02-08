import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { verifyAuthForWallet } from '@/lib/auth'

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

        // Verify session auth — only wallet owner can claim
        const auth = verifyAuthForWallet(request, wallet)
        if (!auth.authenticated) {
            return NextResponse.json({ error: auth.error }, { status: 401 })
        }

        const walletLower = wallet.toLowerCase()

        // Rate limit
        const { success } = await ratelimit.limit(`daily-login:${walletLower}`)
        if (!success) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
        }

        const key = `player:${walletLower}`
        const now = Date.now()

        /**
         * Lua script: atomic cooldown-check + point award.
         * Prevents double-claim if two requests arrive simultaneously.
         */
        const DAILY_LOGIN_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local cooldown = tonumber(ARGV[2])
local pointsToAdd = tonumber(ARGV[3])
local walletLower = ARGV[4]

local lastLogin = tonumber(redis.call('HGET', key, 'lastDailyLogin')) or 0

if (now - lastLogin) < cooldown then
  local nextClaim = lastLogin + cooldown
  return 'COOLDOWN:' .. nextClaim .. ':' .. (nextClaim - now)
end

local currentPoints = tonumber(redis.call('HGET', key, 'dailyLoginPoints')) or 0
local newPoints = currentPoints + pointsToAdd

redis.call('HSET', key, 'lastDailyLogin', now)
redis.call('HSET', key, 'dailyLoginPoints', newPoints)

local w = redis.call('HGET', key, 'wallet')
if not w or w == '' then
  redis.call('HSET', key, 'wallet', walletLower)
end

return 'OK:' .. newPoints .. ':' .. (now + cooldown)
`

        const result = await redis.eval(
            DAILY_LOGIN_LUA,
            [key],
            [now, COOLDOWN_MS, DAILY_LOGIN_POINTS, walletLower]
        ) as string

        const resultStr = String(result)

        if (resultStr.startsWith('COOLDOWN')) {
            const parts = resultStr.split(':')
            const nextClaimTime = parseInt(parts[1], 10)
            const cooldownRemaining = parseInt(parts[2], 10)
            return NextResponse.json({
                success: false,
                error: 'Already claimed today! Come back later.',
                nextClaimTime,
                cooldownRemaining
            }, { status: 400 })
        }

        const parts = resultStr.split(':')
        const newPoints = parseInt(parts[1], 10)
        const nextClaimTime = parseInt(parts[2], 10)

        return NextResponse.json({
            success: true,
            pointsEarned: DAILY_LOGIN_POINTS,
            totalDailyLoginPoints: newPoints,
            nextClaimTime,
            message: `+${DAILY_LOGIN_POINTS} points claimed!`
        })
    } catch (error) {
        console.error('Daily login POST error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
