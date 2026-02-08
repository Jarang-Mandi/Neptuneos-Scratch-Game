import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Point values per level (Updated: Easy:3, Medium:5, Hard:10)
const LEVEL_POINTS: Record<string, number> = {
    easy: 3,
    medium: 5,
    hard: 10
}

// Quest point values
const DAILY_LOGIN_POINTS = 2
const SUPPORTER_BONUS_POINTS = 50
const REFERRAL_POINTS = 10

// Initialize Redis client
const redis = Redis.fromEnv()

// Rate limiter: 10 requests per 10 seconds per IP
const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '10 s'),
    analytics: true,
})

// Wallet address validation
function isValidWallet(wallet: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(wallet)
}

interface PlayerStats {
    wallet: string
    easyWins: number
    mediumWins: number
    hardWins: number
    isSupporter: boolean
    // New fields for quest system
    supporterBonusClaimed?: boolean
    lastDailyLogin?: number
    dailyLoginPoints?: number
    referralCode?: string
    referredBy?: string
    referralCount?: number
    dailyWinCount?: number
    dailyWinDate?: string
}

// Cache for leaderboard (10 seconds)
let leaderboardCache: { data: any; timestamp: number } | null = null
const CACHE_TTL = 10000 // 10 seconds

export async function GET(request: NextRequest) {
    try {
        // Rate limiting by IP
        const ip = request.headers.get('x-forwarded-for') || 'anonymous'
        const { success } = await ratelimit.limit(ip)

        if (!success) {
            return NextResponse.json(
                { error: 'Too many requests. Please slow down.' },
                { status: 429 }
            )
        }

        // Check cache first
        if (leaderboardCache && Date.now() - leaderboardCache.timestamp < CACHE_TTL) {
            return NextResponse.json(leaderboardCache.data, {
                headers: {
                    'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59',
                    'X-Cache': 'HIT'
                }
            })
        }

        // Get all player keys using SCAN instead of KEYS (more efficient)
        const keys: string[] = []
        let cursor = '0'
        do {
            const result = await redis.scan(cursor, { match: 'player:*', count: 100 })
            cursor = String(result[0])
            keys.push(...result[1])
        } while (cursor !== '0')

        if (keys.length === 0) {
            const data = { entries: [], total: 0 }
            leaderboardCache = { data, timestamp: Date.now() }
            return NextResponse.json(data)
        }

        // Fetch all player data using pipeline for efficiency
        const players: PlayerStats[] = []

        // Process in batches to avoid memory issues
        const batchSize = 50
        for (let i = 0; i < keys.length; i += batchSize) {
            const batch = keys.slice(i, i + batchSize)
            const pipeline = redis.pipeline()

            for (const key of batch) {
                pipeline.hgetall(key)
            }

            const results = await pipeline.exec()

            for (const player of results) {
                if (player) {
                    players.push({
                        wallet: String((player as any).wallet || ''),
                        easyWins: Number((player as any).easyWins || 0),
                        mediumWins: Number((player as any).mediumWins || 0),
                        hardWins: Number((player as any).hardWins || 0),
                        isSupporter: Boolean((player as any).isSupporter || false),
                        supporterBonusClaimed: Boolean((player as any).supporterBonusClaimed || false),
                        dailyLoginPoints: Number((player as any).dailyLoginPoints || 0),
                        referralCount: Number((player as any).referralCount || 0)
                    })
                }
            }
        }

        // Calculate total points for each player (game + quest points) and sort
        const entries = players
            .filter(p => p.wallet) // Remove invalid entries
            .map(player => {
                // Game points from wins
                const gamePoints =
                    player.easyWins * LEVEL_POINTS.easy +
                    player.mediumWins * LEVEL_POINTS.medium +
                    player.hardWins * LEVEL_POINTS.hard

                // Quest points
                const dailyLoginPts = player.dailyLoginPoints || 0
                const supporterPts = player.supporterBonusClaimed ? SUPPORTER_BONUS_POINTS : 0
                const referralPts = (player.referralCount || 0) * REFERRAL_POINTS

                // Total = game + all quest points
                const totalPoints = gamePoints + dailyLoginPts + supporterPts + referralPts

                return {
                    wallet: player.wallet,
                    totalPoints,
                    gamePoints,
                    easyWins: player.easyWins,
                    mediumWins: player.mediumWins,
                    hardWins: player.hardWins,
                    isSupporter: player.isSupporter
                }
            })
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .slice(0, 100)
            .map((entry, idx) => ({
                rank: idx + 1,
                ...entry
            }))

        const data = { entries, total: players.length }

        // Update cache
        leaderboardCache = { data, timestamp: Date.now() }

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
