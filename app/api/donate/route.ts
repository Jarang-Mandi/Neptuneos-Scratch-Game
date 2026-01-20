import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

// Get Redis credentials (try multiple env var names)
const getRedisUrl = () => {
    return process.env.STORAGE_REST_API_URL ||
        process.env.STORAGE_URL ||
        process.env.KV_REST_API_URL ||
        process.env.UPSTASH_REDIS_REST_URL ||
        ''
}

const getRedisToken = () => {
    return process.env.STORAGE_REST_API_TOKEN ||
        process.env.STORAGE_TOKEN ||
        process.env.KV_REST_API_TOKEN ||
        process.env.UPSTASH_REDIS_REST_TOKEN ||
        ''
}

const redis = new Redis({
    url: getRedisUrl(),
    token: getRedisToken(),
})

export async function POST(request: NextRequest) {
    try {
        if (!getRedisUrl() || !getRedisToken()) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
        }

        const body = await request.json()
        const { wallet } = body

        if (!wallet) {
            return NextResponse.json({ error: 'Missing wallet' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()
        const playerKey = `player:${walletLower}`
        const supporterKey = `supporter:${walletLower}`

        // Update player supporter status
        const existing = await redis.hgetall(playerKey)
        if (existing) {
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

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Donate POST error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        if (!getRedisUrl() || !getRedisToken()) {
            return NextResponse.json({ isSupporter: false, donatedAt: null })
        }

        const { searchParams } = new URL(request.url)
        const wallet = searchParams.get('wallet')

        if (!wallet) {
            return NextResponse.json({ error: 'Missing wallet' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()
        const supporter = await redis.hgetall(`supporter:${walletLower}`)

        return NextResponse.json({
            isSupporter: !!supporter,
            donatedAt: supporter?.donatedAt || null
        })
    } catch (error) {
        console.error('Donate GET error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
