'use client'

import { useState, useEffect, useRef } from 'react'

interface LeaderboardEntry {
    rank: number
    wallet: string
    totalPoints: number
    easyWins: number
    mediumWins: number
    hardWins: number
    isSupporter: boolean
    isGTD: boolean
}

interface InlineLeaderboardProps {
    refreshTrigger?: number // Increment this to trigger refresh
}

// Minimum interval between refreshes (10s debounce)
const REFRESH_DEBOUNCE_MS = 10_000

export default function InlineLeaderboard({ refreshTrigger = 0 }: InlineLeaderboardProps) {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const lastFetchRef = useRef(0)

    useEffect(() => {
        const now = Date.now()
        const elapsed = now - lastFetchRef.current

        if (elapsed < REFRESH_DEBOUNCE_MS && lastFetchRef.current !== 0) {
            // Debounce: skip fetch if last one was < 10s ago
            return
        }

        lastFetchRef.current = now
        fetchLeaderboard()
    }, [refreshTrigger])

    const fetchLeaderboard = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/leaderboard')
            if (res.ok) {
                const data = await res.json()
                setEntries(data.entries || [])
            }
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="glass-panel" style={{ marginTop: '20px' }}>
            <h3 style={{
                color: '#58d8ff',
                marginBottom: '15px',
                textAlign: 'center',
                fontSize: '18px',
            }}>
                🏆 Leaderboard
            </h3>

            {/* Leaderboard Table */}
            {isLoading ? (
                <p style={{ textAlign: 'center', color: '#888' }}>Loading...</p>
            ) : entries.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888', fontSize: '14px' }}>
                    No entries yet. Be the first to play!
                </p>
            ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '13px',
                    }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(88, 216, 255, 0.2)' }}>
                                <th style={{ padding: '8px 5px', textAlign: 'center', color: '#58d8ff' }}>#</th>
                                <th style={{ padding: '8px 5px', textAlign: 'left', color: '#58d8ff' }}>Player</th>
                                <th style={{ padding: '8px 5px', textAlign: 'center', color: '#58d8ff' }}>Pts</th>
                                <th style={{ padding: '8px 5px', textAlign: 'center', color: '#58d8ff', fontSize: '10px' }}>E/M/H</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry, idx) => (
                                <tr key={entry.wallet} style={{
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                    background: idx < 3 ? 'rgba(88, 216, 255, 0.05)' : 'transparent',
                                }}>
                                    <td style={{ padding: '8px 5px', textAlign: 'center' }}>
                                        {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : idx + 1}
                                    </td>
                                    <td style={{ padding: '8px 5px' }}>
                                        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                            {entry.wallet.slice(0, 6)}...{entry.wallet.slice(-4)}
                                        </span>
                                        {entry.isSupporter && (
                                            <span style={{
                                                marginLeft: '4px',
                                                fontSize: '10px',
                                                background: 'linear-gradient(135deg, #f6d365, #fda085)',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                            }}>⭐</span>
                                        )}
                                        {entry.isGTD && (
                                            <span style={{
                                                marginLeft: '4px',
                                                fontSize: '9px',
                                                background: 'linear-gradient(135deg, #00d2ff, #3a7bd5)',
                                                color: '#fff',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontWeight: 'bold',
                                            }}>GTD</span>
                                        )}
                                    </td>
                                    <td style={{
                                        padding: '8px 5px',
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        color: '#58d8ff'
                                    }}>
                                        {entry.totalPoints}
                                    </td>
                                    <td style={{
                                        padding: '8px 5px',
                                        textAlign: 'center',
                                        fontSize: '11px',
                                        color: '#666'
                                    }}>
                                        {entry.easyWins}/{entry.mediumWins}/{entry.hardWins}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

        </div>
    )
}
