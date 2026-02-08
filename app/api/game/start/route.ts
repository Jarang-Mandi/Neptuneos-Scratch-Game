import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import {
    generateGameId,
    signGameToken,
    generateGameCells,
    getLevelConfig,
    isValidLevel,
    isValidWallet
} from '@/lib/gameSession'
import { verifyAuthForWallet } from '@/lib/auth'

const redis = Redis.fromEnv()

// Rate limiter: 10 game starts per minute per wallet
const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    analytics: true,
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { wallet, level } = body

        if (!wallet || !isValidWallet(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
        }

        // Verify session auth — only wallet owner can start a game
        const auth = verifyAuthForWallet(request, wallet)
        if (!auth.authenticated) {
            return NextResponse.json({ error: auth.error }, { status: 401 })
        }

        if (!level || !isValidLevel(level)) {
            return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()

        // Rate limit by wallet
        const { success } = await ratelimit.limit(`game-start:${walletLower}`)
        if (!success) {
            return NextResponse.json(
                { error: 'Too many requests. Please slow down.' },
                { status: 429 }
            )
        }

        // Generate server-side game state
        const gameId = generateGameId()
        const token = signGameToken(gameId, walletLower)
        const cells = generateGameCells(level)
        const config = getLevelConfig(level)

        // Store game session in Redis with 10-minute TTL
        // Cell contents (bomb positions, emojis) are stored SERVER-SIDE only
        await redis.set(`game:${gameId}`, JSON.stringify({
            wallet: walletLower,
            level,
            cells,
            revealedIndices: [],
            status: 'active',
            createdAt: Date.now()
        }), { ex: 600 })

        // Return game metadata WITHOUT revealing cell contents
        return NextResponse.json({
            gameId,
            token,
            gridSize: config.size,
            totalBombs: config.bombs,
            totalCells: config.size * config.size
        })
    } catch (error) {
        console.error('Game start error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
