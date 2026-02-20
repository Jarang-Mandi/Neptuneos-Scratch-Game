import { NextRequest, NextResponse } from 'next/server'
import { redis, createRateLimiter, getClientIp, LEADERBOARD_KEY, LEADERBOARD_CACHE_KEY, POINTS } from '@/lib/redis'

// Rate limiter: 10 requests per 10 seconds per IP
const ratelimit = createRateLimiter(10, '10 s')

// Wallet address validation
function isValidWallet(wallet: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(wallet)
}

const CACHE_TTL = 10 // 10 seconds

/**
 * One-time migration: rebuild sorted-set leaderboard from existing player hashes.
 * Only runs when the sorted set is empty (first deploy or after FLUSHALL).
 */
async function rebuildLeaderboard(): Promise<void> {
    const lockKey = 'leaderboard:rebuilding'
    // Acquire simple lock to avoid concurrent rebuilds
    const acquired = await redis.set(lockKey, '1', { nx: true, ex: 60 })
    if (!acquired) return // Another instance is rebuilding

    try {
        const keys: string[] = []
        let cursor = '0'
        do {
            const result = await redis.scan(cursor, { match: 'player:*', count: 100 })
            cursor = String(result[0])
            keys.push(...result[1])
        } while (cursor !== '0')

        if (keys.length === 0) return

        // Pipeline HMGET + compute scores in batches of 100
        const batchSize = 100
        for (let i = 0; i < keys.length; i += batchSize) {
            const batch = keys.slice(i, i + batchSize)
            const pipeline = redis.pipeline()
            for (const key of batch) {
                pipeline.hmget(key, 'wallet', 'easyWins', 'mediumWins', 'hardWins', 'dailyLoginPoints', 'supporterBonusClaimed', 'referralCount')
            }
            const results = await pipeline.exec()

            const zaddPipeline = redis.pipeline()
            for (const vals of results) {
                const v = vals as (string | null)[]
                if (!v || !v[0]) continue
                const wallet = v[0]
                const score =
                    (Number(v[1]) || 0) * POINTS.easy +
                    (Number(v[2]) || 0) * POINTS.medium +
                    (Number(v[3]) || 0) * POINTS.hard +
                    (Number(v[4]) || 0) +
                    ((v[5] === 'true' || v[5] === '1') ? POINTS.supporterBonus : 0) +
                    (Number(v[6]) || 0) * POINTS.referral
                zaddPipeline.zadd(LEADERBOARD_KEY, { score, member: wallet })
            }
            await zaddPipeline.exec()
        }
    } finally {
        await redis.del(lockKey)
    }
}

export async function GET(request: NextRequest) {
    try {
        // Rate limiting by IP
        const ip = getClientIp(request)
        const { success } = await ratelimit.limit(ip)

        if (!success) {
            return NextResponse.json(
                { error: 'Too many requests. Please slow down.' },
                { status: 429 }
            )
        }

        // Check Redis cache first (shared across all serverless instances)
        const cached = await redis.get(LEADERBOARD_CACHE_KEY)
        if (cached) {
            return NextResponse.json(cached, {
                headers: {
                    'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59',
                    'X-Cache': 'HIT'
                }
            })
        }

        // Check if sorted set exists, rebuild if empty (one-time migration)
        const count = await redis.zcard(LEADERBOARD_KEY)
        if (count === 0) {
            await rebuildLeaderboard()
        }

        const totalPlayers = await redis.zcard(LEADERBOARD_KEY)

        // Get top 100 from sorted set — O(log N + 100) instead of O(N)
        const topWallets = await redis.zrange(LEADERBOARD_KEY, 0, 99, { rev: true, withScores: true })

        if (!topWallets || topWallets.length === 0) {
            const data = { entries: [], total: 0 }
            await redis.set(LEADERBOARD_CACHE_KEY, JSON.stringify(data), { ex: CACHE_TTL })
            return NextResponse.json(data)
        }

        // Extract wallets and scores from zrange result
        // topWallets is [member, score, member, score, ...]
        const wallets: string[] = []
        const scores: number[] = []
        for (let i = 0; i < topWallets.length; i += 2) {
            wallets.push(String(topWallets[i]))
            scores.push(Number(topWallets[i + 1]))
        }

        // Pipeline HMGET for just the top 100 wallets (not ALL players)
        const batchSize = 50
        const playerData: Record<string, any> = {}
        for (let i = 0; i < wallets.length; i += batchSize) {
            const batch = wallets.slice(i, i + batchSize)
            const pipeline = redis.pipeline()
            for (const w of batch) {
                pipeline.hmget(`player:${w}`, 'easyWins', 'mediumWins', 'hardWins', 'isSupporter')
            }
            const results = await pipeline.exec()
            batch.forEach((w, idx) => {
                const v = results[idx] as (string | null)[]
                playerData[w] = {
                    easyWins: Number(v?.[0]) || 0,
                    mediumWins: Number(v?.[1]) || 0,
                    hardWins: Number(v?.[2]) || 0,
                    isSupporter: v?.[3] === 'true' || v?.[3] === '1'
                }
            })
        }

        // Build response
        const entries = wallets.map((w, idx) => {
            const p = playerData[w] || {}
            const gamePoints =
                (p.easyWins || 0) * POINTS.easy +
                (p.mediumWins || 0) * POINTS.medium +
                (p.hardWins || 0) * POINTS.hard

            return {
                rank: idx + 1,
                wallet: w,
                totalPoints: scores[idx],
                gamePoints,
                easyWins: p.easyWins || 0,
                mediumWins: p.mediumWins || 0,
                hardWins: p.hardWins || 0,
                isSupporter: p.isSupporter || false
            }
        })

        const data = { entries, total: totalPlayers }

        // Cache in Redis (shared across all serverless instances)
        await redis.set(LEADERBOARD_CACHE_KEY, JSON.stringify(data), { ex: CACHE_TTL })

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59',
                'X-Cache': 'MISS'
            }
        })
    } catch (error) {
        console.error('Leaderboard GET error:', error)
        return NextResponse.json({
            entries: [],
            total: 0,
            error: 'Failed to fetch leaderboard'
        }, { status: 500 })
    }
}

// DEPRECATED: Wins are now recorded atomically via /api/game/reveal → recordWin()
// This endpoint is kept for backward compatibility but rejects all POST requests.
export async function POST() {
    return NextResponse.json(
        { error: 'This endpoint is deprecated. Wins are recorded server-side via /api/game/reveal.' },
        { status: 410 }
    )
}
