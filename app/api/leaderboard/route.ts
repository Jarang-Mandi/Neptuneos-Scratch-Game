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
 * Rebuild version — bump this to force a full resync of all player hashes
 * into the sorted-set leaderboard on next request after deploy.
 */
const REBUILD_VERSION = 2
const REBUILD_VERSION_KEY = 'leaderboard:rebuild_version'

/**
 * Rebuild sorted-set leaderboard from existing player hashes.
 * Runs once per REBUILD_VERSION so old players are always backfilled.
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

        console.log(`[Leaderboard] Rebuilding sorted set from ${keys.length} player keys`)
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

            // Upstash SDK hmget returns { field: value } object (NOT array)
            // Values are auto-parsed: "5" → 5 (number), "true" → true (boolean)
            const zaddItems: { score: number; member: string }[] = []
            for (let j = 0; j < results.length; j++) {
                const v = results[j] as Record<string, unknown> | null
                if (!v) continue

                // Extract wallet from key name (more reliable than hash field)
                const wallet = batch[j].replace('player:', '')
                if (!isValidWallet(wallet)) continue

                const score =
                    (Number(v.easyWins) || 0) * POINTS.easy +
                    (Number(v.mediumWins) || 0) * POINTS.medium +
                    (Number(v.hardWins) || 0) * POINTS.hard +
                    (Number(v.dailyLoginPoints) || 0) +
                    (v.supporterBonusClaimed === true || v.supporterBonusClaimed === 'true' || v.supporterBonusClaimed === '1' ? POINTS.supporterBonus : 0) +
                    (Number(v.referralCount) || 0) * POINTS.referral
                zaddItems.push({ score, member: wallet })
            }

            // Guard: skip exec if no valid players in this batch
            if (zaddItems.length > 0) {
                const zaddPipeline = redis.pipeline()
                for (const item of zaddItems) {
                    zaddPipeline.zadd(LEADERBOARD_KEY, item)
                }
                await zaddPipeline.exec()
                console.log(`[Leaderboard] Rebuild batch: added ${zaddItems.length} entries`)
            }
        }
    } finally {
        // Mark this version as rebuilt so it doesn't run again
        await redis.set(REBUILD_VERSION_KEY, REBUILD_VERSION)
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
        if (cached && typeof cached === 'object' && (cached as any).entries?.length > 0) {
            return NextResponse.json(cached, {
                headers: {
                    'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59',
                    'X-Cache': 'HIT'
                }
            })
        }

        // Check if rebuild is needed (version mismatch or empty sorted set)
        const [currentVersion, count] = await Promise.all([
            redis.get(REBUILD_VERSION_KEY),
            redis.zcard(LEADERBOARD_KEY),
        ])
        if (count === 0 || Number(currentVersion) !== REBUILD_VERSION) {
            // Clear any stale rebuild lock before retrying
            await redis.del('leaderboard:rebuilding')
            await redis.del(LEADERBOARD_CACHE_KEY)
            await rebuildLeaderboard()
        }

        const totalPlayers = await redis.zcard(LEADERBOARD_KEY)

        // Get top 100 from sorted set — O(log N + 100) instead of O(N)
        const topWallets = await redis.zrange(LEADERBOARD_KEY, 0, 99, { rev: true, withScores: true })

        if (!topWallets || topWallets.length === 0) {
            const data = { entries: [], total: totalPlayers }
            await redis.set(LEADERBOARD_CACHE_KEY, JSON.stringify(data), { ex: CACHE_TTL })
            return NextResponse.json(data)
        }

        // Upstash SDK zrange with withScores returns Array<{ score: number, member: string }>
        // Handle both object format and legacy alternating format for safety
        const wallets: string[] = []
        const scores: number[] = []

        if (topWallets.length > 0 && typeof topWallets[0] === 'object' && topWallets[0] !== null && 'member' in (topWallets[0] as any)) {
            // Object format: [{ member: "0x...", score: 10 }, ...]
            for (const item of topWallets as Array<{ member: string; score: number }>) {
                wallets.push(String(item.member))
                scores.push(Number(item.score))
            }
        } else if (topWallets.length > 0 && typeof topWallets[0] === 'object' && topWallets[0] !== null && 'value' in (topWallets[0] as any)) {
            // Some SDK versions use 'value' instead of 'member'
            for (const item of topWallets as Array<{ value: string; score: number }>) {
                wallets.push(String(item.value))
                scores.push(Number(item.score))
            }
        } else {
            // Legacy alternating format: [member, score, member, score, ...]
            for (let i = 0; i < topWallets.length; i += 2) {
                wallets.push(String(topWallets[i]))
                scores.push(Number(topWallets[i + 1]))
            }
        }

        if (wallets.length === 0) {
            const data = { entries: [], total: totalPlayers }
            await redis.set(LEADERBOARD_CACHE_KEY, JSON.stringify(data), { ex: CACHE_TTL })
            return NextResponse.json(data)
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
            // Upstash SDK hmget returns { field: value } object (NOT array)
            batch.forEach((w, idx) => {
                const v = results[idx] as Record<string, unknown> | null
                playerData[w] = {
                    easyWins: Number(v?.easyWins) || 0,
                    mediumWins: Number(v?.mediumWins) || 0,
                    hardWins: Number(v?.hardWins) || 0,
                    isSupporter: v?.isSupporter === true || v?.isSupporter === 'true' || v?.isSupporter === '1'
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
