import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Point values per level (Updated: Easy:3, Medium:5, Hard:10)
const LEVEL_POINTS: Record<string, number> = {
    easy: 3,
    medium: 5,
    hard: 10
}

// Daily win limit
const DAILY_WIN_LIMIT = 10

// Initialize Redis client
const redis = Redis.fromEnv()

// Rate limiter: 10 requests per 10 seconds per IP
const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '10 s'),
    analytics: true,
})

// Rate limiter for POST: 5 wins per minute per wallet (anti-cheat)
const winRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    analytics: true,
})

// Wallet address validation
function isValidWallet(wallet: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(wallet)
}

// Get current date string for daily reset (UTC)
function getTodayDateString(): string {
    return new Date().toISOString().split('T')[0]
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
                        isSupporter: Boolean((player as any).isSupporter || false)
                    })
                }
            }
        }

        // Calculate total points for each player and sort
        const entries = players
            .filter(p => p.wallet) // Remove invalid entries
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

// Record a win
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { wallet, level, isSupporter = false } = body

        // Validate inputs
        if (!wallet || !level) {
            return NextResponse.json({ error: 'Missing wallet or level' }, { status: 400 })
        }

        if (!isValidWallet(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 })
        }

        if (!['easy', 'medium', 'hard'].includes(level)) {
            return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()

        // Rate limit by wallet address (anti-cheat: max 5 wins per minute)
        const { success, remaining } = await winRatelimit.limit(`win:${walletLower}`)

        if (!success) {
            return NextResponse.json({
                error: 'You are playing too fast! Please wait a moment.',
                remaining: 0
            }, { status: 429 })
        }

        const key = `player:${walletLower}`
        const today = getTodayDateString()

        // Get existing player data or create new
        const existing = await redis.hgetall(key)

        // Check and reset daily win count if new day
        let currentDailyWins = Number(existing?.dailyWinCount || 0)
        const lastWinDate = String(existing?.dailyWinDate || '')

        if (lastWinDate !== today) {
            // New day, reset counter
            currentDailyWins = 0
        }

        // Check daily win limit (10 wins per day)
        if (currentDailyWins >= DAILY_WIN_LIMIT) {
            return NextResponse.json({
                error: 'Daily win limit reached! Come back tomorrow.',
                dailyWinsRemaining: 0,
                limitReached: true
            }, { status: 429 })
        }

        const player: PlayerStats = {
            wallet: walletLower,
            easyWins: Number(existing?.easyWins || 0),
            mediumWins: Number(existing?.mediumWins || 0),
            hardWins: Number(existing?.hardWins || 0),
            isSupporter: Boolean(existing?.isSupporter || false),
            supporterBonusClaimed: Boolean(existing?.supporterBonusClaimed || false),
            dailyWinCount: currentDailyWins + 1,
            dailyWinDate: today,
            referralCode: String(existing?.referralCode || ''),
            referredBy: String(existing?.referredBy || ''),
            referralCount: Number(existing?.referralCount || 0),
            lastDailyLogin: Number(existing?.lastDailyLogin || 0),
            dailyLoginPoints: Number(existing?.dailyLoginPoints || 0)
        }

        // Increment wins for the level
        if (level === 'easy') player.easyWins++
        else if (level === 'medium') player.mediumWins++
        else if (level === 'hard') player.hardWins++

        if (isSupporter) player.isSupporter = true

        // Save to Redis with all fields
        await redis.hset(key, {
            wallet: player.wallet,
            easyWins: player.easyWins,
            mediumWins: player.mediumWins,
            hardWins: player.hardWins,
            isSupporter: player.isSupporter,
            supporterBonusClaimed: player.supporterBonusClaimed,
            dailyWinCount: player.dailyWinCount,
            dailyWinDate: player.dailyWinDate,
            referralCode: player.referralCode,
            referredBy: player.referredBy,
            referralCount: player.referralCount,
            lastDailyLogin: player.lastDailyLogin,
            dailyLoginPoints: player.dailyLoginPoints
        })

        // Invalidate cache
        leaderboardCache = null

        // Calculate new total points (game points only)
        const gamePoints =
            player.easyWins * LEVEL_POINTS.easy +
            player.mediumWins * LEVEL_POINTS.medium +
            player.hardWins * LEVEL_POINTS.hard

        return NextResponse.json({
            success: true,
            totalPoints: gamePoints,
            pointsEarned: LEVEL_POINTS[level],
            dailyWinsRemaining: DAILY_WIN_LIMIT - player.dailyWinCount!,
            remaining // Show remaining rate limit
        })
    } catch (error) {
        console.error('Leaderboard POST error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
