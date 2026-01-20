'use client'

import { useState, useEffect } from 'react'

// Point values per level
const LEVEL_POINTS: Record<string, number> = {
    easy: 1,
    medium: 2,
    hard: 3
}

interface LeaderboardEntry {
    rank: number
    wallet: string
    totalPoints: number
    easyWins: number
    mediumWins: number
    hardWins: number
    isSupporter: boolean
}

export default function Leaderboard() {
    const [isOpen, setIsOpen] = useState(false)
    const [entries, setEntries] = useState<LeaderboardEntry[]>([])
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchLeaderboard()
        }
    }, [isOpen])

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

    if (!isOpen) {
        return (
            <button className="leaderboard-btn" onClick={() => setIsOpen(true)}>
                🏆 Leaderboard
            </button>
        )
    }

    return (
        <div className="leaderboard-overlay" onClick={() => setIsOpen(false)}>
            <div className="leaderboard-content" onClick={e => e.stopPropagation()}>
                <button
                    className="popup-close"
                    onClick={() => setIsOpen(false)}
                    style={{ position: 'absolute', top: 10, right: 10 }}
                >
                    ✖
                </button>

                <h2 style={{ color: '#58d8ff', marginBottom: '15px' }}>🏆 Leaderboard</h2>

                {/* Points Info */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '15px',
                    marginBottom: '15px',
                    fontSize: '12px',
                    color: '#aaa'
                }}>
                    <span>🟢 Easy: 1pt</span>
                    <span>🟡 Medium: 2pt</span>
                    <span>🔴 Hard: 3pt</span>
                </div>

                {/* Leaderboard Table */}
                {isLoading ? (
                    <p style={{ textAlign: 'center' }}>Loading...</p>
                ) : entries.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#888' }}>
                        No entries yet. Be the first to play!
                    </p>
                ) : (
                    <table className="leaderboard-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Player</th>
                                <th>Points</th>
                                <th style={{ fontSize: '11px' }}>E/M/H</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.slice(0, 100).map((entry, idx) => (
                                <tr key={entry.wallet}>
                                    <td>
                                        {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : idx + 1}
                                    </td>
                                    <td>
                                        {entry.wallet.slice(0, 6)}...{entry.wallet.slice(-4)}
                                        {entry.isSupporter && <span className="supporter-badge">⭐</span>}
                                    </td>
                                    <td style={{ fontWeight: 'bold', color: '#58d8ff' }}>
                                        {entry.totalPoints}
                                    </td>
                                    <td style={{ fontSize: '11px', color: '#888' }}>
                                        {entry.easyWins}/{entry.mediumWins}/{entry.hardWins}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                <p style={{ fontSize: '11px', color: '#666', marginTop: '15px', textAlign: 'center' }}>
                    Top 350 players get GTD WL! 🎁
                </p>
            </div>
        </div>
    )
}
