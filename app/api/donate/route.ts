import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.STORAGE_REST_API_URL || '',
    token: process.env.STORAGE_REST_API_TOKEN || '',
})

export async function POST(request: NextRequest) {
    try {
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
