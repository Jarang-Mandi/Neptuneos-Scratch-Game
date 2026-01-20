import { NextRequest, NextResponse } from 'next/server'

// Export supporters or top players for NFT distribution
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'supporters'
    const format = searchParams.get('format') || 'json'

    try {
        if (type === 'supporters') {
            // Get all supporters via donate API
            const donateRes = await fetch(new URL('/api/donate', request.url).toString())
            // Note: This is a placeholder - in production, you'd query the database directly

            const supporters: { wallet: string; donatedAt: number }[] = [
                // This would be populated from database
                // { wallet: '0x...', donatedAt: timestamp }
            ]

            if (format === 'csv') {
                const csv = 'wallet,donatedAt\n' +
                    supporters.map((s: { wallet: string; donatedAt: number }) =>
                        `${s.wallet},${new Date(s.donatedAt).toISOString()}`
                    ).join('\n')

                return new NextResponse(csv, {
                    headers: {
                        'Content-Type': 'text/csv',
                        'Content-Disposition': 'attachment; filename=supporters.csv'
                    }
                })
            }

            return NextResponse.json({
                type: 'supporters',
                total: supporters.length,
                data: supporters
            })
        }

        if (type === 'top350') {
            // Get top 350 players across all levels
            const allEntries: { wallet: string; wins: number; level: string }[] = []

            for (const level of ['easy', 'medium', 'hard']) {
                const res = await fetch(new URL(`/api/leaderboard?level=${level}`, request.url).toString())
                if (res.ok) {
                    const data = await res.json()
                    allEntries.push(...data.entries.map((e: { wallet: string; wins: number }) => ({
                        ...e,
                        level
                    })))
                }
            }

            // Sort by total wins and get top 350
            const walletTotals = new Map<string, number>()
            allEntries.forEach(e => {
                walletTotals.set(e.wallet, (walletTotals.get(e.wallet) || 0) + e.wins)
            })

            const top350 = Array.from(walletTotals.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 350)
                .map(([wallet, totalWins], idx) => ({
                    rank: idx + 1,
                    wallet,
                    totalWins
                }))

            if (format === 'csv') {
                const csv = 'rank,wallet,totalWins\n' +
                    top350.map(p => `${p.rank},${p.wallet},${p.totalWins}`).join('\n')

                return new NextResponse(csv, {
                    headers: {
                        'Content-Type': 'text/csv',
                        'Content-Disposition': 'attachment; filename=top350_whitelist.csv'
                    }
                })
            }

            return NextResponse.json({
                type: 'top350',
                total: top350.length,
                data: top350
            })
        }

        return NextResponse.json({ error: 'Invalid type. Use: supporters or top350' }, { status: 400 })
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
