'use client'

import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import Navbar from '@/components/Navbar'
import ScratchGame from '@/components/ScratchGame'
import DonateButton from '@/components/DonateButton'
import Leaderboard from '@/components/Leaderboard'

export default function Home() {
    const { address, isConnected } = useAccount()
    const [isSupporter, setIsSupporter] = useState(false)
    const [stats, setStats] = useState({ wins: 0, losses: 0, points: 0 })

    const handleWin = useCallback(async (level: string) => {
        const pointsEarned = level === 'easy' ? 1 : level === 'medium' ? 2 : 3
        setStats(prev => ({
            ...prev,
            wins: prev.wins + 1,
            points: prev.points + pointsEarned
        }))

        // Record win to backend
        if (isConnected && address) {
            try {
                await fetch('/api/leaderboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet: address,
                        level,
                        isSupporter
                    })
                })
            } catch (error) {
                console.error('Failed to record win:', error)
            }
        }
    }, [isConnected, address, isSupporter])

    const handleLose = useCallback(() => {
        setStats(prev => ({ ...prev, losses: prev.losses + 1 }))
    }, [])

    const handleDonateSuccess = useCallback(async () => {
        setIsSupporter(true)

        // Record supporter status to backend
        if (address) {
            try {
                await fetch('/api/donate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ wallet: address })
                })
            } catch (error) {
                console.error('Failed to record donation:', error)
            }
        }
    }, [address])

    return (
        <>
            {/* Navbar with Wallet */}
            <Navbar />

            <main>
                {/* Donation Button */}
                {isConnected && (
                    <DonateButton
                        isSupporter={isSupporter}
                        onDonateSuccess={handleDonateSuccess}
                    />
                )}

                {/* Game Stats */}
                {isConnected && (stats.wins > 0 || stats.losses > 0) && (
                    <div style={{
                        textAlign: 'center',
                        marginBottom: '10px',
                        fontSize: '14px',
                        color: '#aaa'
                    }}>
                        🎮 Session: {stats.wins}W / {stats.losses}L | 🏆 {stats.points} pts
                    </div>
                )}

                {/* Main Game */}
                <ScratchGame
                    onWin={handleWin}
                    onLose={handleLose}
                />

                {/* Leaderboard Button */}
                <div style={{ textAlign: 'center', marginTop: '15px' }}>
                    <Leaderboard />
                </div>
            </main>
        </>
    )
}
