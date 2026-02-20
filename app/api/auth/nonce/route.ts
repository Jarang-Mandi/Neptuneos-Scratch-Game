import { NextRequest, NextResponse } from 'next/server'
import { createRateLimiter, getClientIp } from '@/lib/redis'
import { generateNonce, buildSignMessage } from '@/lib/auth'

// Rate limiter: 10 requests per minute per IP
const ratelimit = createRateLimiter(10, '60 s')

/**
 * GET /api/auth/nonce?wallet=0x...
 * 
 * Returns a one-time nonce for the wallet to sign.
 * The nonce expires in 5 minutes and is single-use.
 */
export async function GET(request: NextRequest) {
    try {
        // Rate limit by IP to prevent nonce flooding
        const ip = getClientIp(request)
        const { success } = await ratelimit.limit(`nonce:${ip}`)
        if (!success) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
        }

        const { searchParams } = new URL(request.url)
        const wallet = searchParams.get('wallet')

        if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
        }

        const nonce = await generateNonce(wallet)
        const message = buildSignMessage(nonce)

        return NextResponse.json({ nonce, message })
    } catch (error) {
        console.error('Nonce generation error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
