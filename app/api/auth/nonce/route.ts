import { NextRequest, NextResponse } from 'next/server'
import { generateNonce, buildSignMessage } from '@/lib/auth'

/**
 * GET /api/auth/nonce?wallet=0x...
 * 
 * Returns a one-time nonce for the wallet to sign.
 * The nonce expires in 5 minutes and is single-use.
 */
export async function GET(request: NextRequest) {
    try {
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
