import { NextRequest, NextResponse } from 'next/server'
import { createRateLimiter, getClientIp } from '@/lib/redis'
import {
    consumeNonce,
    buildSignMessage,
    verifyWalletSignature,
    createSessionToken
} from '@/lib/auth'

// Rate limiter: 5 login attempts per minute per IP
const ratelimit = createRateLimiter(5, '60 s')

/**
 * POST /api/auth/login
 * 
 * Body: { wallet, signature }
 * 
 * Verifies the wallet signed the correct nonce message,
 * then returns a session token valid for 24 hours.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = getClientIp(request)
        const { success } = await ratelimit.limit(`auth-login:${ip}`)
        if (!success) {
            return NextResponse.json(
                { error: 'Too many login attempts. Please wait.' },
                { status: 429 }
            )
        }

        const body = await request.json()
        const { wallet, signature } = body

        if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
        }

        if (!signature || typeof signature !== 'string') {
            return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()

        // Retrieve and consume the nonce (one-time use)
        const nonce = await consumeNonce(walletLower)
        if (!nonce) {
            return NextResponse.json(
                { error: 'Nonce expired or not found. Please request a new one.' },
                { status: 400 }
            )
        }

        // Reconstruct the message and verify the signature
        const message = buildSignMessage(nonce)
        const isValid = await verifyWalletSignature(wallet, message, signature)

        if (!isValid) {
            return NextResponse.json(
                { error: 'Invalid signature. Please try again.' },
                { status: 401 }
            )
        }

        // Signature valid — issue session token
        const token = createSessionToken(walletLower)

        return NextResponse.json({
            success: true,
            token,
            wallet: walletLower,
            expiresIn: 24 * 60 * 60 // 24 hours in seconds
        })
    } catch (error) {
        console.error('Auth login error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
