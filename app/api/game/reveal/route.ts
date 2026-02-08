import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { verifyGameToken, isValidWallet, type GameSessionData } from '@/lib/gameSession'
import { recordWin } from '@/lib/leaderboardHelper'
import { verifyAuthForWallet } from '@/lib/auth'

const redis = Redis.fromEnv()

// Higher rate limit for cell reveals (many reveals per game)
const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '10 s'),
    analytics: true,
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { gameId, token, wallet, cellIndex } = body

        // Validate all required inputs
        if (!gameId || typeof gameId !== 'string') {
            return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 })
        }
        if (!token || typeof token !== 'string') {
            return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
        }
        if (!wallet || !isValidWallet(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
        }

        // Verify session auth
        const auth = verifyAuthForWallet(request, wallet)
        if (!auth.authenticated) {
            return NextResponse.json({ error: auth.error }, { status: 401 })
        }

        if (typeof cellIndex !== 'number' || cellIndex < 0) {
            return NextResponse.json({ error: 'Invalid cell index' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()

        // Rate limit by wallet
        const { success } = await ratelimit.limit(`game-reveal:${walletLower}`)
        if (!success) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
        }

        // Verify HMAC token (ensures gameId is authentic and not forged)
        if (!verifyGameToken(gameId, walletLower, token)) {
            return NextResponse.json({ error: 'Invalid game token' }, { status: 403 })
        }

        // Get game session from Redis
        const sessionRaw = await redis.get(`game:${gameId}`)
        if (!sessionRaw) {
            return NextResponse.json(
                { error: 'Game session expired or not found' },
                { status: 404 }
            )
        }

        const session: GameSessionData = typeof sessionRaw === 'string'
            ? JSON.parse(sessionRaw)
            : sessionRaw as GameSessionData

        // Validate session ownership
        if (session.wallet !== walletLower) {
            return NextResponse.json({ error: 'Wallet mismatch' }, { status: 403 })
        }

        if (session.status !== 'active') {
            return NextResponse.json({ error: 'Game already ended' }, { status: 400 })
        }

        // Validate cell index bounds
        if (cellIndex >= session.cells.length) {
            return NextResponse.json({ error: 'Cell index out of bounds' }, { status: 400 })
        }

        // Prevent re-revealing a cell
        if (session.revealedIndices.includes(cellIndex)) {
            return NextResponse.json({ error: 'Cell already revealed' }, { status: 400 })
        }

        const cell = session.cells[cellIndex]
        session.revealedIndices.push(cellIndex)

        // === BOMB HIT — LOSS ===
        if (cell.isBomb) {
            session.status = 'lost'
            await redis.del(`game:${gameId}`)

            return NextResponse.json({
                cellResult: { emoji: '💣', isBomb: true },
                gameOver: true,
                won: false,
                allCells: session.cells // Reveal entire board on loss
            })
        }

        // === SAFE CELL — Check if all safe cells revealed (WIN) ===
        const totalSafeCells = session.cells.filter(c => !c.isBomb).length
        const revealedSafeCells = session.revealedIndices.filter(
            idx => !session.cells[idx].isBomb
        ).length

        if (revealedSafeCells >= totalSafeCells) {
            // WIN — record to leaderboard server-side (no client trust)
            session.status = 'won'
            await redis.del(`game:${gameId}`)

            const winResult = await recordWin(walletLower, session.level)

            return NextResponse.json({
                cellResult: { emoji: cell.emoji, isBomb: false },
                gameOver: true,
                won: true,
                allCells: session.cells,
                pointsEarned: winResult.pointsEarned,
                dailyWinsRemaining: winResult.dailyWinsRemaining,
                limitReached: winResult.limitReached
            })
        }

        // === GAME CONTINUES — update session in Redis ===
        await redis.set(`game:${gameId}`, JSON.stringify(session), { ex: 600 })

        return NextResponse.json({
            cellResult: { emoji: cell.emoji, isBomb: false },
            gameOver: false,
            won: false
        })
    } catch (error) {
        console.error('Game reveal error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
