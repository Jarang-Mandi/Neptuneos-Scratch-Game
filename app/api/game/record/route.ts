import { NextResponse } from 'next/server'

/**
 * DEPRECATED — Game results are now recorded server-side via /api/game/reveal.
 * All legacy code has been removed to prevent build errors.
 */

export async function POST() {
    return NextResponse.json(
        { error: 'This endpoint is deprecated. Use /api/game/start and /api/game/reveal instead.' },
        { status: 410 }
    )
}

export async function GET() {
    return NextResponse.json(
        { error: 'This endpoint is deprecated. Use /api/profile?wallet=0x... instead.' },
        { status: 410 }
    )
}
