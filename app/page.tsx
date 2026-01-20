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
                {/* Wallet Connection Required Notice */}
                {!isConnected && (
                    <div style={{
                        textAlign: 'center',
                        padding: '30px 20px',
                        marginBottom: '20px',
                        background: 'rgba(88, 216, 255, 0.1)',
                        borderRadius: '12px',
                        border: '2px solid rgba(88, 216, 255, 0.3)',
                    }}>
                        <h2 style={{ color: '#58d8ff', marginBottom: '10px' }}>🔐 Wallet Required</h2>
                        <p style={{ color: '#aaa', marginBottom: '15px' }}>
                            Connect your wallet to play and track your score on the leaderboard
                        </p>
                        <p style={{ fontSize: '12px', color: '#666' }}>
                            Click "Connect Wallet" in the navbar above ☝️
                        </p>
                    </div>
                )}

                {/* Connected User Section */}
                {isConnected && (
                    <>
                        {/* Donation Section */}
                        <div style={{
                            textAlign: 'center',
                            marginBottom: '15px',
                            padding: '15px',
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '8px',
                        }}>
                            <DonateButton
                                isSupporter={isSupporter}
                                onDonateSuccess={handleDonateSuccess}
                            />
                        </div>

                        {/* Game Stats */}
                        {(stats.wins > 0 || stats.losses > 0) && (
                            <div style={{
                                textAlign: 'center',
                                marginBottom: '10px',
                                fontSize: '14px',
                                color: '#aaa'
                            }}>
                                🎮 Session: {stats.wins}W / {stats.losses}L | 🏆 {stats.points} pts
                            </div>
                        )}
                    </>
                )}

                {/* Main Game - Only show if wallet connected */}
                {isConnected ? (
                    <ScratchGame
                        onWin={handleWin}
                        onLose={handleLose}
                    />
                ) : (
                    <div style={{
                        textAlign: 'center',
                        padding: '50px 20px',
                        opacity: 0.3,
                        pointerEvents: 'none',
                    }}>
                        <h1>Scratch Game</h1>
                        <p style={{ color: '#666' }}>Game locked - connect wallet to play</p>
                    </div>
                )}

                {/* Leaderboard Button - Always visible */}
                <div style={{ textAlign: 'center', marginTop: '15px' }}>
                    <Leaderboard />
                </div>
            </main>
        </>
    )
}
