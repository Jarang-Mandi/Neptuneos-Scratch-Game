import { NextRequest, NextResponse } from 'next/server'
import { redis, createRateLimiter, LEADERBOARD_KEY, POINTS, makeRecalcScoreLua } from '@/lib/redis'
import { verifyAuthForWallet } from '@/lib/auth'

const ratelimit = createRateLimiter(20, '60 s')

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

        const gamePoints = (easyWins * POINTS.easy) +
            (mediumWins * POINTS.medium) +
            (hardWins * POINTS.hard)

        const dailyLoginPoints = Number(data.dailyLoginPoints || 0)
        const isSupporter = Boolean(data.isSupporter)
        const supporterBonusClaimed = Boolean(data.supporterBonusClaimed)
        const supporterPoints = supporterBonusClaimed ? POINTS.supporterBonus : 0

        const referralCount = Number(data.referralCount || 0)
        const referralPoints = referralCount * POINTS.referral

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
        }, {
            headers: {
                'Cache-Control': 'private, s-maxage=5, stale-while-revalidate=30'
            }
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

        // Verify session auth — only wallet owner can claim bonus
        const auth = verifyAuthForWallet(request, wallet)
        if (!auth.authenticated) {
            return NextResponse.json({ error: auth.error }, { status: 401 })
        }

        const walletLower = wallet.toLowerCase()
        const key = `player:${walletLower}`

        if (action === 'claim_supporter_bonus') {
            /**
             * Lua script: atomic supporter-bonus claim + leaderboard ZADD.
             * Checks isSupporter + supporterBonusClaimed in one atomic op,
             * preventing double-claim from concurrent requests.
             * KEYS[1] = player hash key, KEYS[2] = leaderboard sorted set
             */
            const SUPPORTER_BONUS_LUA = `
local key = KEYS[1]
local walletLower = ARGV[1]

local isSupporter = redis.call('HGET', key, 'isSupporter')
if not isSupporter or isSupporter == 'false' or isSupporter == '0' then
  return 'NOT_SUPPORTER'
end

local claimed = redis.call('HGET', key, 'supporterBonusClaimed')
if claimed == 'true' or claimed == '1' then
  return 'ALREADY_CLAIMED'
end

redis.call('HSET', key, 'supporterBonusClaimed', 'true')

${makeRecalcScoreLua('KEYS[2]', 'walletLower')}

return 'OK'
`

            const result = await redis.eval(
                SUPPORTER_BONUS_LUA,
                [key, LEADERBOARD_KEY],
                [walletLower]
            ) as string

            const resultStr = String(result)

            if (resultStr === 'NOT_SUPPORTER') {
                return NextResponse.json({
                    success: false,
                    error: 'You must be a supporter to claim this bonus!'
                }, { status: 400 })
            }

            if (resultStr === 'ALREADY_CLAIMED') {
                return NextResponse.json({
                    success: false,
                    error: 'Supporter bonus already claimed!'
                }, { status: 400 })
            }

            return NextResponse.json({
                success: true,
                pointsEarned: POINTS.supporterBonus,
                message: `+${POINTS.supporterBonus} supporter bonus claimed!`
            })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (error) {
        console.error('Profile POST error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
