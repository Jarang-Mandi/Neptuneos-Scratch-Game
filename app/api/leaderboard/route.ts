import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

// Point values per level
const LEVEL_POINTS: Record<string, number> = {
    easy: 1,
    medium: 2,
    hard: 3
}

// Initialize Redis client with environment variables
// Vercel auto-adds these when you connect Upstash
const redis = new Redis({
    url: process.env.STORAGE_REST_API_URL || '',
    token: process.env.STORAGE_REST_API_TOKEN || '',
})

interface PlayerStats {
    wallet: string
    easyWins: number
    mediumWins: number
    hardWins: number
    isSupporter: boolean
}

export async function GET() {
    try {
        // Get all player keys from Redis
        const keys = await redis.keys('player:*')

        if (keys.length === 0) {
            return NextResponse.json({
                entries: [],
                total: 0
            })
        }

        // Fetch all player data
        const players: PlayerStats[] = []
        for (const key of keys) {
            const player = await redis.hgetall(key)
            if (player) {
                players.push({
                    wallet: String(player.wallet || ''),
                    easyWins: Number(player.easyWins || 0),
                    mediumWins: Number(player.mediumWins || 0),
                    hardWins: Number(player.hardWins || 0),
                    isSupporter: Boolean(player.isSupporter || false)
                })
            }
        }

        // Calculate total points for each player and sort
        const entries = players
            .map(player => ({
                wallet: player.wallet,
                totalPoints:
                    player.easyWins * LEVEL_POINTS.easy +
                    player.mediumWins * LEVEL_POINTS.medium +
                    player.hardWins * LEVEL_POINTS.hard,
                easyWins: player.easyWins,
                mediumWins: player.mediumWins,
                hardWins: player.hardWins,
                isSupporter: player.isSupporter
            }))
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .slice(0, 100)
            .map((entry, idx) => ({
                rank: idx + 1,
                ...entry
            }))

        return NextResponse.json({
            entries,
            total: players.length
        })
    } catch (error) {
        console.error('Leaderboard GET error:', error)
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
    }
}

// Record a win
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { wallet, level, isSupporter = false } = body

        if (!wallet || !level) {
            return NextResponse.json({ error: 'Missing wallet or level' }, { status: 400 })
        }

        if (!['easy', 'medium', 'hard'].includes(level)) {
            return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()
        const key = `player:${walletLower}`

        // Get existing player data or create new
        const existing = await redis.hgetall(key)

        const player: PlayerStats = {
            wallet: walletLower,
            easyWins: Number(existing?.easyWins || 0),
            mediumWins: Number(existing?.mediumWins || 0),
            hardWins: Number(existing?.hardWins || 0),
            isSupporter: Boolean(existing?.isSupporter || false)
        }

        // Increment wins for the level
        if (level === 'easy') player.easyWins++
        else if (level === 'medium') player.mediumWins++
        else if (level === 'hard') player.hardWins++

        if (isSupporter) player.isSupporter = true

        // Save to Redis
        await redis.hset(key, {
            wallet: player.wallet,
            easyWins: player.easyWins,
            mediumWins: player.mediumWins,
            hardWins: player.hardWins,
            isSupporter: player.isSupporter
        })

        // Calculate new total points
        const totalPoints =
            player.easyWins * LEVEL_POINTS.easy +
            player.mediumWins * LEVEL_POINTS.medium +
            player.hardWins * LEVEL_POINTS.hard

        return NextResponse.json({
            success: true,
            totalPoints,
            pointsEarned: LEVEL_POINTS[level]
        })
    } catch (error) {
        console.error('Leaderboard POST error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
