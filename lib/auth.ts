import crypto from 'crypto'
import { Redis } from '@upstash/redis'
import { verifyMessage } from 'viem'
import { NextRequest, NextResponse } from 'next/server'

const _authSecret = process.env.GAME_SECRET
if (!_authSecret) {
    throw new Error('FATAL: GAME_SECRET environment variable is required. Generate one with: openssl rand -hex 32')
}
const AUTH_SECRET: string = _authSecret
const SESSION_TTL = 24 * 60 * 60 // 24 hours in seconds
const NONCE_TTL = 300 // 5 minutes in seconds

const redis = Redis.fromEnv()

// ===== NONCE MANAGEMENT =====

/**
 * Generate a cryptographically-secure nonce for wallet signature challenge.
 * Stored in Redis with 5-minute TTL to prevent replay attacks.
 */
export async function generateNonce(wallet: string): Promise<string> {
    const nonce = crypto.randomBytes(32).toString('hex')
    const walletLower = wallet.toLowerCase()
    await redis.set(`nonce:${walletLower}`, nonce, { ex: NONCE_TTL })
    return nonce
}

/**
 * Consume a nonce — returns it if valid, null if expired/missing.
 * Deletes after read to prevent replay.
 */
export async function consumeNonce(wallet: string): Promise<string | null> {
    const walletLower = wallet.toLowerCase()
    const key = `nonce:${walletLower}`
    const nonce = await redis.get(key)
    if (nonce) {
        await redis.del(key) // One-time use
    }
    return nonce as string | null
}

/**
 * Build the message that the user must sign.
 * Format is deterministic so server can reconstruct it for verification.
 */
export function buildSignMessage(nonce: string): string {
    return `Sign this message to login to The Scratch Game.\n\nNonce: ${nonce}\n\nThis does not cost any gas.`
}

// ===== SESSION TOKEN =====

interface TokenPayload {
    wallet: string
    iat: number   // issued at (unix seconds)
    exp: number   // expires at (unix seconds)
}

/**
 * Create an HMAC-signed session token (lightweight JWT alternative).
 * Format: base64(payload).base64(signature)
 */
export function createSessionToken(wallet: string): string {
    const now = Math.floor(Date.now() / 1000)
    const payload: TokenPayload = {
        wallet: wallet.toLowerCase(),
        iat: now,
        exp: now + SESSION_TTL
    }
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = crypto
        .createHmac('sha256', AUTH_SECRET)
        .update(payloadB64)
        .digest('base64url')
    return `${payloadB64}.${signature}`
}

/**
 * Verify and decode a session token.
 * Returns wallet address if valid, null otherwise.
 */
export function verifySessionToken(token: string): string | null {
    try {
        const parts = token.split('.')
        if (parts.length !== 2) return null

        const [payloadB64, signature] = parts

        // Verify HMAC signature (timing-safe)
        const expectedSig = crypto
            .createHmac('sha256', AUTH_SECRET)
            .update(payloadB64)
            .digest('base64url')

        const sigBuffer = Buffer.from(signature, 'base64url')
        const expectedBuffer = Buffer.from(expectedSig, 'base64url')
        if (sigBuffer.length !== expectedBuffer.length) return null
        if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null

        // Decode and validate payload
        const payload: TokenPayload = JSON.parse(
            Buffer.from(payloadB64, 'base64url').toString()
        )

        const now = Math.floor(Date.now() / 1000)
        if (payload.exp <= now) return null  // Expired
        if (!payload.wallet) return null

        return payload.wallet.toLowerCase()
    } catch {
        return null
    }
}

// ===== SIGNATURE VERIFICATION =====

/**
 * Verify that a wallet signature is valid for the given message.
 * Uses viem's verifyMessage (EIP-191 personal_sign).
 */
export async function verifyWalletSignature(
    wallet: string,
    message: string,
    signature: string
): Promise<boolean> {
    try {
        const isValid = await verifyMessage({
            address: wallet as `0x${string}`,
            message,
            signature: signature as `0x${string}`
        })
        return isValid
    } catch {
        return false
    }
}

// ===== REQUEST AUTH HELPER =====

export interface AuthResult {
    authenticated: boolean
    wallet: string | null
    error?: string
}

/**
 * Extract and verify auth token from request.
 * Use this in any protected API route:
 * 
 * ```ts
 * const auth = verifyAuth(request)
 * if (!auth.authenticated) {
 *     return NextResponse.json({ error: auth.error }, { status: 401 })
 * }
 * const wallet = auth.wallet!
 * ```
 */
export function verifyAuth(request: NextRequest): AuthResult {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authenticated: false, wallet: null, error: 'Missing authorization header' }
    }

    const token = authHeader.slice(7) // Remove "Bearer "
    const wallet = verifySessionToken(token)

    if (!wallet) {
        return { authenticated: false, wallet: null, error: 'Invalid or expired session token' }
    }

    return { authenticated: true, wallet }
}

/**
 * Verify auth AND that the authenticated wallet matches the wallet in the request body.
 * Prevents user A from performing actions as user B.
 */
export function verifyAuthForWallet(request: NextRequest, requestWallet: string): AuthResult {
    const auth = verifyAuth(request)
    if (!auth.authenticated) return auth

    if (auth.wallet !== requestWallet.toLowerCase()) {
        return {
            authenticated: false,
            wallet: null,
            error: 'Wallet mismatch — you can only perform actions for your own wallet'
        }
    }

    return auth
}
