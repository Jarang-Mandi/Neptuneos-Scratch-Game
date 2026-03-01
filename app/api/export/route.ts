import { NextRequest, NextResponse } from 'next/server'
import { redis, createRateLimiter, getClientIp } from '@/lib/redis'
import crypto from 'crypto'

// Strict rate limiter: 2 requests per hour per IP (export is expensive)
const ratelimit = createRateLimiter(2, '3600 s')

export async function GET(request: NextRequest) {
    try {
        // Rate limiting - export is expensive, limit to 2 per hour
        const ip = getClientIp(request)
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

        // Admin authentication required — timing-safe comparison prevents side-channel attacks
        const authKey = request.headers.get('x-admin-key')
        if (!process.env.ADMIN_KEY || !authKey ||
            !crypto.timingSafeEqual(Buffer.from(authKey), Buffer.from(process.env.ADMIN_KEY))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get all player keys using SCAN (more efficient)
        const playerKeys: string[] = []
        let cursor = '0'
        do {
            const result = await redis.scan(cursor, { match: 'player:*', count: 100 })
            cursor = String(result[0])
            playerKeys.push(...result[1])
        } while (cursor !== '0')

        // Fetch all players using pipelines (instead of sequential HGETALL)
        const players = []
        const batchSize = 50
        for (let i = 0; i < playerKeys.length; i += batchSize) {
            const batch = playerKeys.slice(i, i + batchSize)
            const pipeline = redis.pipeline()
            for (const key of batch) {
                pipeline.hgetall(key)
            }
            const results = await pipeline.exec()
            for (const player of results) {
                if (player) {
                    const easyWins = Number((player as any).easyWins || 0)
                    const mediumWins = Number((player as any).mediumWins || 0)
                    const hardWins = Number((player as any).hardWins || 0)
                    // Updated points: Easy:3, Medium:5, Hard:10
                    const totalPoints = easyWins * 3 + mediumWins * 5 + hardWins * 10

                    players.push({
                        wallet: String((player as any).wallet),
                        totalPoints,
                        easyWins,
                        mediumWins,
                        hardWins,
                        isSupporter: Boolean((player as any).isSupporter),
                        isGTD: Boolean((player as any).isGTD)
                    })
                }
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
        for (let i = 0; i < supporterKeys.length; i += batchSize) {
            const batch = supporterKeys.slice(i, i + batchSize)
            const pipeline = redis.pipeline()
            for (const key of batch) {
                pipeline.hgetall(key)
            }
            const results = await pipeline.exec()
            for (const supporter of results) {
                if (supporter) {
                    supporters.push({
                        wallet: String((supporter as any).wallet),
                        donatedAt: Number((supporter as any).donatedAt || 0)
                    })
                }
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
