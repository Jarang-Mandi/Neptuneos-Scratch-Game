import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for supporters (replace with Vercel Postgres in production)
interface Supporter {
    wallet: string
    donatedAt: number
}

const supporters: Supporter[] = []

// Record a donation
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { wallet } = body

        if (!wallet) {
            return NextResponse.json({ error: 'Wallet required' }, { status: 400 })
        }

        // Check if already a supporter
        const existing = supporters.find(s => s.wallet.toLowerCase() === wallet.toLowerCase())

        if (!existing) {
            supporters.push({
                wallet: wallet.toLowerCase(),
                donatedAt: Date.now()
            })
        }

        // Update supporter status in leaderboard
        for (const level of ['easy', 'medium', 'hard']) {
            await fetch(new URL('/api/leaderboard', request.url).toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet, level, isSupporter: true })
            })
        }

        return NextResponse.json({
            success: true,
            isSupporter: true,
            message: 'Thank you for your support! You will receive FCFS free NFT mint.'
        })
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}

// Check supporter status
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')

    if (!wallet) {
        return NextResponse.json({ error: 'Wallet required' }, { status: 400 })
    }

    const supporter = supporters.find(s => s.wallet.toLowerCase() === wallet.toLowerCase())

    return NextResponse.json({
        wallet,
        isSupporter: !!supporter,
        donatedAt: supporter?.donatedAt
    })
}
