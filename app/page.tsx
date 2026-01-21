'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { parseAbi } from 'viem'
import Navbar from '@/components/Navbar'
import ScratchGame from '@/components/ScratchGame'
import DonateButton from '@/components/DonateButton'
import InlineLeaderboard from '@/components/InlineLeaderboard'
import { DONATION_CONTRACT_ADDRESS } from '@/lib/wagmi'

// Contract ABI for checking supporter status
const donationAbi = parseAbi([
    'function isSupporter(address) view returns (bool)',
])

export default function Home() {
    const { address, isConnected } = useAccount()
    const [isSupporter, setIsSupporter] = useState(false)
    const [stats, setStats] = useState({ wins: 0, losses: 0, points: 0 })
    const [leaderboardRefresh, setLeaderboardRefresh] = useState(0)
    const [isMusicPlaying, setIsMusicPlaying] = useState(false)
    const bgmRef = useRef<HTMLAudioElement>(null)

    // Read supporter status from smart contract
    const { data: isSupporterOnChain } = useReadContract({
        address: DONATION_CONTRACT_ADDRESS,
        abi: donationAbi,
        functionName: 'isSupporter',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address && DONATION_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000'
        }
    })

    // Update supporter status when contract data changes
    useEffect(() => {
        if (isSupporterOnChain !== undefined) {
            setIsSupporter(isSupporterOnChain)
        }
    }, [isSupporterOnChain])

    // Also check Redis API for supporter status (fallback)
    useEffect(() => {
        const checkSupporterStatus = async () => {
            if (!address) return

            try {
                const response = await fetch(`/api/donate?wallet=${address}`)
                const data = await response.json()
                if (data.isSupporter) {
                    setIsSupporter(true)
                }
            } catch (error) {
                console.error('Failed to check supporter status:', error)
            }
        }

        if (address) {
            checkSupporterStatus()
        }
    }, [address])

    // Music toggle handler
    const handleMusicToggle = useCallback(() => {
        if (bgmRef.current) {
            if (isMusicPlaying) {
                bgmRef.current.pause()
                setIsMusicPlaying(false)
            } else {
                bgmRef.current.volume = 0.5
                bgmRef.current.play()
                    .then(() => setIsMusicPlaying(true))
                    .catch(err => console.warn('Music play failed:', err.message))
            }
        }
    }, [isMusicPlaying])

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
                // Refresh leaderboard
                setLeaderboardRefresh(prev => prev + 1)
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
            {/* Background Music */}
            <audio ref={bgmRef} src="/bgm.mp3" loop preload="auto" />

            {/* Navbar with Wallet & Burger Menu */}
            <Navbar
                onMusicToggle={handleMusicToggle}
                isMusicPlaying={isMusicPlaying}
            />

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

                {/* Inline Leaderboard - Always visible */}
                <InlineLeaderboard refreshTrigger={leaderboardRefresh} />
            </main>
        </>
    )
}
