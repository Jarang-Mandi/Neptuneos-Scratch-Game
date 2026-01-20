import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for game records (replace with Vercel Postgres in production)
interface GameRecord {
    wallet: string
    level: string
    won: boolean
    timestamp: number
}

const gameRecords: GameRecord[] = []

// Record a game result
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { wallet, level, won } = body

        if (!wallet || !level || typeof won !== 'boolean') {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        if (!['easy', 'medium', 'hard'].includes(level)) {
            return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
        }

        // Add record
        gameRecords.push({
            wallet: wallet.toLowerCase(),
            level,
            won,
            timestamp: Date.now()
        })

        // If won, update leaderboard
        if (won) {
            await fetch(new URL('/api/leaderboard', request.url).toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet, level })
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}

// Get player stats
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')

    if (!wallet) {
        return NextResponse.json({ error: 'Wallet required' }, { status: 400 })
    }

    const playerGames = gameRecords.filter(g => g.wallet.toLowerCase() === wallet.toLowerCase())

    const stats = {
        easy: { wins: 0, total: 0 },
        medium: { wins: 0, total: 0 },
        hard: { wins: 0, total: 0 }
    }

    playerGames.forEach(game => {
        if (stats[game.level as keyof typeof stats]) {
            stats[game.level as keyof typeof stats].total++
            if (game.won) stats[game.level as keyof typeof stats].wins++
        }
    })

    return NextResponse.json({ wallet, stats })
}
