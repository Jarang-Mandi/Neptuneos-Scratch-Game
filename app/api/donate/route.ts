import { NextRequest, NextResponse } from 'next/server'
import { redis, createRateLimiter, getClientIp, LEADERBOARD_KEY, makeRecalcScoreLua } from '@/lib/redis'
import { verifySupporterOnChain } from '@/lib/onchain'
import { verifyAuthForWallet } from '@/lib/auth'

// Rate limiter: 5 requests per minute per IP (POST)
const ratelimit = createRateLimiter(5, '60 s')
// Rate limiter: 10 requests per minute per IP (GET — previously unprotected)
const getRatelimit = createRateLimiter(10, '60 s')

// Wallet address validation
function isValidWallet(wallet: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(wallet)
}

export async function POST(request: NextRequest) {
    try {
        // Rate limiting by IP
        const ip = getClientIp(request)
        const { success } = await ratelimit.limit(`donate:${ip}`)

        if (!success) {
            return NextResponse.json(
                { error: 'Too many requests. Please wait.' },
                { status: 429 }
            )
        }

        const body = await request.json()
        const { wallet } = body

        if (!wallet) {
            return NextResponse.json({ error: 'Missing wallet' }, { status: 400 })
        }

        if (!isValidWallet(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
        }

        // Verify session auth — only wallet owner can register donation
        const auth = verifyAuthForWallet(request, wallet)
        if (!auth.authenticated) {
            return NextResponse.json({ error: auth.error }, { status: 401 })
        }

        const walletLower = wallet.toLowerCase()
        const playerKey = `player:${walletLower}`
        const supporterKey = `supporter:${walletLower}`

        // SECURITY: Verify supporter status on-chain before trusting
        // This prevents fake supporter claims — the smart contract is the source of truth
        const isSupporterOnChain = await verifySupporterOnChain(walletLower)
        if (!isSupporterOnChain) {
            return NextResponse.json({
                error: 'Donation not confirmed on-chain. Please wait for transaction confirmation and try again.',
                isSupporter: false
            }, { status: 400 })
        }

        /**
         * Lua script: atomic supporter registration + leaderboard ZADD.
         * Checks supporter key existence + sets both player and supporter keys
         * in one atomic operation — prevents duplicate processing.
         * KEYS[1] = player key, KEYS[2] = supporter key, KEYS[3] = leaderboard sorted set
         */
        const REGISTER_SUPPORTER_LUA = `
local playerKey = KEYS[1]
local supporterKey = KEYS[2]
local walletLower = ARGV[1]
local now = ARGV[2]

local existingDonatedAt = redis.call('HGET', supporterKey, 'donatedAt')
if existingDonatedAt and existingDonatedAt ~= '' then
  return 'ALREADY'
end

redis.call('HSET', playerKey, 'isSupporter', 'true')
redis.call('HSET', supporterKey, 'wallet', walletLower, 'donatedAt', now)

local key = playerKey
${makeRecalcScoreLua('KEYS[3]', 'walletLower')}

return 'OK'
`

        const result = await redis.eval(
            REGISTER_SUPPORTER_LUA,
            [playerKey, supporterKey, LEADERBOARD_KEY],
            [walletLower, Date.now()]
        ) as string

        const resultStr = String(result)

        if (resultStr === 'ALREADY') {
            return NextResponse.json({
                success: true,
                message: 'Already a supporter',
                isSupporter: true
            })
        }

        return NextResponse.json({ success: true, isSupporter: true })
    } catch (error) {
        console.error('Donate POST error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const wallet = searchParams.get('wallet')

        if (!wallet) {
            return NextResponse.json({ error: 'Missing wallet' }, { status: 400 })
        }

        if (!isValidWallet(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
        }

        // Rate limit GET by IP
        const ip = getClientIp(request)
        const { success: rlSuccess } = await getRatelimit.limit(`donate-get:${ip}`)
        if (!rlSuccess) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
        }

        const walletLower = wallet.toLowerCase()
        const supporter = await redis.hgetall(`supporter:${walletLower}`)

        return NextResponse.json({
            isSupporter: supporter && Object.keys(supporter).length > 0,
            donatedAt: supporter?.donatedAt || null
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
            }
        })
    } catch (error) {
        console.error('Donate GET error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
