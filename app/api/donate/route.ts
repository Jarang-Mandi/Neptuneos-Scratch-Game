import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const redis = Redis.fromEnv()

// Rate limiter: 5 requests per minute per IP
const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    analytics: true,
})

// Wallet address validation
function isValidWallet(wallet: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(wallet)
}

export async function POST(request: NextRequest) {
    try {
        // Rate limiting by IP
        const ip = request.headers.get('x-forwarded-for') || 'anonymous'
        const { success } = await ratelimit.limit(`donate:${ip}`)

        if (!success) {
            return NextResponse.json(
                { error: 'Too many requests. Please wait.' },
                { status: 429 }
            )
        }

        const body = await request.json()
        const { wallet } = body

        if (!wallet) {
            return NextResponse.json({ error: 'Missing wallet' }, { status: 400 })
        }

        if (!isValidWallet(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()
        const playerKey = `player:${walletLower}`
        const supporterKey = `supporter:${walletLower}`

        // Check if already a supporter (prevent duplicate entries)
        const existingSupporter = await redis.hgetall(supporterKey)
        if (existingSupporter && Object.keys(existingSupporter).length > 0) {
            return NextResponse.json({
                success: true,
                message: 'Already a supporter',
                isSupporter: true
            })
        }

        // Update player supporter status
        const existing = await redis.hgetall(playerKey)
        if (existing && Object.keys(existing).length > 0) {
            await redis.hset(playerKey, {
                ...existing,
                isSupporter: true
            })
        }

        // Record in supporters list
        await redis.hset(supporterKey, {
            wallet: walletLower,
            donatedAt: Date.now()
        })

        return NextResponse.json({ success: true, isSupporter: true })
    } catch (error) {
        console.error('Donate POST error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const wallet = searchParams.get('wallet')

        if (!wallet) {
            return NextResponse.json({ error: 'Missing wallet' }, { status: 400 })
        }

        if (!isValidWallet(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()
        const supporter = await redis.hgetall(`supporter:${walletLower}`)

        return NextResponse.json({
            isSupporter: supporter && Object.keys(supporter).length > 0,
            donatedAt: supporter?.donatedAt || null
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
            }
        })
    } catch (error) {
        console.error('Donate GET error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
