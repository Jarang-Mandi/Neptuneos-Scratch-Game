import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const redis = Redis.fromEnv()

// Strict rate limiter: 2 requests per hour per IP (export is expensive)
const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(2, '3600 s'),
    analytics: true,
})

export async function GET(request: NextRequest) {
    try {
        // Rate limiting - export is expensive, limit to 2 per hour
        const ip = request.headers.get('x-forwarded-for') || 'anonymous'
        const { success, remaining } = await ratelimit.limit(`export:${ip}`)

        if (!success) {
            return NextResponse.json(
                {
                    error: 'Export rate limited. Please try again later.',
                    message: 'You can only export data 2 times per hour.'
                },
                { status: 429 }
            )
        }

        // Optional: Check for admin key (if you want to restrict exports)
        // const authKey = request.headers.get('x-admin-key')
        // if (authKey !== process.env.ADMIN_KEY) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        // }

        // Get all player keys using SCAN (more efficient)
        const playerKeys: string[] = []
        let cursor = '0'
        do {
            const result = await redis.scan(cursor, { match: 'player:*', count: 100 })
            cursor = String(result[0])
            playerKeys.push(...result[1])
        } while (cursor !== '0')

        // Fetch all players
        const players = []
        for (const key of playerKeys) {
            const player = await redis.hgetall(key)
            if (player) {
                const easyWins = Number(player.easyWins || 0)
                const mediumWins = Number(player.mediumWins || 0)
                const hardWins = Number(player.hardWins || 0)
                // Updated points: Easy:3, Medium:5, Hard:10
                const totalPoints = easyWins * 3 + mediumWins * 5 + hardWins * 10

                players.push({
                    wallet: String(player.wallet),
                    totalPoints,
                    easyWins,
                    mediumWins,
                    hardWins,
                    isSupporter: Boolean(player.isSupporter)
                })
            }
        }

        // Sort by total points
        const sorted = players.sort((a, b) => b.totalPoints - a.totalPoints)

        // Get supporters using SCAN
        const supporterKeys: string[] = []
        cursor = '0'
        do {
            const result = await redis.scan(cursor, { match: 'supporter:*', count: 100 })
            cursor = String(result[0])
            supporterKeys.push(...result[1])
        } while (cursor !== '0')

        const supporters: { wallet: string; donatedAt: number }[] = []
        for (const key of supporterKeys) {
            const supporter = await redis.hgetall(key)
            if (supporter) {
                supporters.push({
                    wallet: String(supporter.wallet),
                    donatedAt: Number(supporter.donatedAt || 0)
                })
            }
        }

        // Export data
        const exportData = {
            timestamp: new Date().toISOString(),
            totalPlayers: players.length,
            totalSupporters: supporters.length,
            remainingExports: remaining,
            leaderboard: sorted,
            supporters: supporters.sort((a, b) => a.donatedAt - b.donatedAt)
        }

        return new NextResponse(JSON.stringify(exportData, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="leaderboard-export-${Date.now()}.json"`,
                'X-RateLimit-Remaining': String(remaining)
            }
        })
    } catch (error) {
        console.error('Export error:', error)
        return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
    }
}
