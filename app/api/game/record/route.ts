import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const redis = Redis.fromEnv()

// Rate limiter: 10 requests per minute per wallet
const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    analytics: true,
})

// Wallet address validation
function isValidWallet(wallet: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(wallet)
}

// DEPRECATED: Game results are now recorded via /api/game/reveal (server-side validation)
// This endpoint is kept for backward compatibility but no longer processes wins.
export async function POST(request: NextRequest) {
    return NextResponse.json(
        { error: 'This endpoint is deprecated. Game results are now validated server-side via /api/game/start and /api/game/reveal.' },
        { status: 410 }
    )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _legacyPost(_request: NextRequest) {
    // Legacy code preserved for reference
    const _wallet = ''
    const _level = ''
    const _won = false
    if (!_wallet || !isValidWallet(_wallet)) {
        //
    }

    if (!_level || !['easy', 'medium', 'hard'].includes(_level)) {
            return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
        }

        if (typeof won !== 'boolean') {
            return NextResponse.json({ error: 'Invalid won status' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()

        // Rate limit by wallet
        const { success } = await ratelimit.limit(`game-record:${walletLower}`)
        if (!success) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
        }

        // If won, update leaderboard (which handles all win logic)
        if (won) {
            try {
                const leaderboardRes = await fetch(new URL('/api/leaderboard', request.url).toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ wallet: walletLower, level })
                })

                const leaderboardData = await leaderboardRes.json()

                if (leaderboardData.limitReached) {
                    return NextResponse.json({
                        success: false,
                        error: 'Daily win limit reached!',
                        limitReached: true
                    }, { status: 429 })
                }

                return NextResponse.json({
                    success: true,
                    pointsEarned: leaderboardData.pointsEarned,
                    dailyWinsRemaining: leaderboardData.dailyWinsRemaining
                })
            } catch (error) {
                console.error('Failed to update leaderboard:', error)
                return NextResponse.json({ error: 'Failed to record win' }, { status: 500 })
            }
        }

        // Loss - just acknowledge
        return NextResponse.json({ success: true, recorded: 'loss' })
    } catch (error) {
        console.error('Game record error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}

// Get player stats from profile API
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')

    if (!wallet || !isValidWallet(wallet)) {
        return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }

    // Redirect to profile API for consistent data
    try {
        const profileRes = await fetch(new URL(`/api/profile?wallet=${wallet}`, request.url).toString())
        const profileData = await profileRes.json()

        return NextResponse.json({
            wallet: wallet.toLowerCase(),
            stats: {
                easy: { wins: profileData.stats?.easyWins || 0 },
                medium: { wins: profileData.stats?.mediumWins || 0 },
                hard: { wins: profileData.stats?.hardWins || 0 }
            },
            dailyWinsRemaining: profileData.dailyWinsRemaining || 10
        })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }
}
