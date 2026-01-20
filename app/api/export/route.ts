import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.STORAGE_REST_API_URL || '',
    token: process.env.STORAGE_REST_API_TOKEN || '',
})

export async function GET() {
    try {
        // Get all player keys
        const playerKeys = await redis.keys('player:*')

        // Fetch all players
        const players = []
        for (const key of playerKeys) {
            const player = await redis.hgetall(key)
            if (player) {
                const easyWins = Number(player.easyWins || 0)
                const mediumWins = Number(player.mediumWins || 0)
                const hardWins = Number(player.hardWins || 0)
                const totalPoints = easyWins * 1 + mediumWins * 2 + hardWins * 3

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

        // Get supporters
        const supporterKeys = await redis.keys('supporter:*')
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
            leaderboard: sorted,
            supporters: supporters.sort((a, b) => a.donatedAt - b.donatedAt)
        }

        return new NextResponse(JSON.stringify(exportData, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="leaderboard-export-${Date.now()}.json"`
            }
        })
    } catch (error) {
        console.error('Export error:', error)
        return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
    }
}
