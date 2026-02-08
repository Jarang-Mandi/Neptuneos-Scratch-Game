import crypto from 'crypto'

const _gameSecret = process.env.GAME_SECRET
if (!_gameSecret) {
    throw new Error('FATAL: GAME_SECRET environment variable is required. Generate one with: openssl rand -hex 32')
}
const GAME_SECRET: string = _gameSecret

const emojis = ["🍒", "⭐", "🍀", "🔔", "🥇", "🍉", "🍇", "🍎", "🎁", "🎉"]

const LEVEL_CONFIG: Record<string, { size: number; bombs: number }> = {
    easy: { size: 3, bombs: 1 },
    medium: { size: 4, bombs: 1 },
    hard: { size: 5, bombs: 2 }
}

export interface GameCell {
    emoji: string
    isBomb: boolean
}

export interface GameSessionData {
    wallet: string
    level: string
    cells: GameCell[]
    revealedIndices: number[]
    status: 'active' | 'won' | 'lost'
    createdAt: number
}

export function isValidLevel(level: string): boolean {
    return ['easy', 'medium', 'hard'].includes(level)
}

export function getLevelConfig(level: string) {
    return LEVEL_CONFIG[level]
}

export function isValidWallet(wallet: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(wallet)
}

/**
 * Generate a unique game session ID using crypto-secure random UUID
 */
export function generateGameId(): string {
    return crypto.randomUUID()
}

/**
 * Create an HMAC signature for a game session.
 * This ensures clients cannot forge or tamper with game IDs.
 */
export function signGameToken(gameId: string, wallet: string): string {
    return crypto
        .createHmac('sha256', GAME_SECRET)
        .update(`${gameId}:${wallet}`)
        .digest('hex')
}

/**
 * Verify an HMAC token using timing-safe comparison to prevent timing attacks.
 */
export function verifyGameToken(gameId: string, wallet: string, token: string): boolean {
    const expected = signGameToken(gameId, wallet)
    try {
        return crypto.timingSafeEqual(
            Buffer.from(expected, 'hex'),
            Buffer.from(token, 'hex')
        )
    } catch {
        return false
    }
}

/**
 * Generate the full game grid server-side using crypto-secure randomness.
 * Bomb positions and emoji assignments are all determined here.
 */
export function generateGameCells(level: string): GameCell[] {
    const config = LEVEL_CONFIG[level]
    if (!config) throw new Error('Invalid level')

    const totalCells = config.size * config.size

    // Generate bomb positions using crypto-secure random
    const bombSet = new Set<number>()
    while (bombSet.size < config.bombs) {
        bombSet.add(crypto.randomInt(totalCells))
    }

    // Generate cells with random emojis
    return Array.from({ length: totalCells }, (_, i) => ({
        emoji: emojis[crypto.randomInt(emojis.length)],
        isBomb: bombSet.has(i)
    }))
}
