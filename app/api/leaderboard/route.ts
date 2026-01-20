import { NextRequest, NextResponse } from 'next/server'

// Point values per level
const LEVEL_POINTS: Record<string, number> = {
    easy: 1,
    medium: 2,
    hard: 3
}

// In-memory storage (replace with Vercel Postgres in production)
interface PlayerStats {
    wallet: string
    easyWins: number
    mediumWins: number
    hardWins: number
    isSupporter: boolean
}

const players: Map<string, PlayerStats> = new Map()

export async function GET() {
    // Calculate total points for each player and sort
    const entries = Array.from(players.values())
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
        total: players.size
    })
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
        let player = players.get(walletLower)

        if (!player) {
            player = {
                wallet: walletLower,
                easyWins: 0,
                mediumWins: 0,
                hardWins: 0,
                isSupporter: false
            }
            players.set(walletLower, player)
        }

        // Increment wins for the level
        if (level === 'easy') player.easyWins++
        else if (level === 'medium') player.mediumWins++
        else if (level === 'hard') player.hardWins++

        if (isSupporter) player.isSupporter = true

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
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
