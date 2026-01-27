'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { parseAbi } from 'viem'
import Navbar from '@/components/Navbar'
import ScratchGame from '@/components/ScratchGame'
import DonateButton from '@/components/DonateButton'
import InlineLeaderboard from '@/components/InlineLeaderboard'
import BottomNav from '@/components/BottomNav'
import QuestList from '@/components/QuestList'
import ProfileTab from '@/components/ProfileTab'
import { DONATION_CONTRACT_ADDRESS } from '@/lib/wagmi'
import { sdk } from '@farcaster/miniapp-sdk'

// Contract ABI for checking supporter status
const donationAbi = parseAbi([
    'function isSupporter(address) view returns (bool)',
])

type TabType = 'game' | 'board' | 'profile'

export default function Home() {
    const { address, isConnected } = useAccount()
    const [isSupporter, setIsSupporter] = useState(false)
    const [stats, setStats] = useState({ wins: 0, losses: 0, points: 0 })
    const [leaderboardRefresh, setLeaderboardRefresh] = useState(0)
    const [isMusicPlaying, setIsMusicPlaying] = useState(false)
    const [activeTab, setActiveTab] = useState<TabType>('game')
    const [farcasterUser, setFarcasterUser] = useState<{ fid?: number; username?: string; pfpUrl?: string } | null>(null)
    const bgmRef = useRef<HTMLAudioElement>(null)

    // Get Farcaster context
    useEffect(() => {
        const initFarcaster = async () => {
            try {
                const context = await sdk.context
                if (context?.user) {
                    setFarcasterUser({
                        fid: context.user.fid,
                        username: context.user.username,
                        pfpUrl: context.user.pfpUrl
                    })
                }
            } catch (e) {
                // Not in Farcaster context
            }
        }
        initFarcaster()
    }, [])

    // Check for referral code in URL
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const refCode = urlParams.get('ref')
        if (refCode && address) {
            // Store referral code to apply later
            localStorage.setItem('pendingReferral', refCode)
        }
    }, [address])

    // Apply pending referral when wallet connects
    useEffect(() => {
        const applyReferral = async () => {
            const pendingRef = localStorage.getItem('pendingReferral')
            if (pendingRef && address) {
                try {
                    const res = await fetch('/api/quest/referral', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ wallet: address, referralCode: pendingRef })
                    })
                    if (res.ok) {
                        localStorage.removeItem('pendingReferral')
                    }
                } catch (e) {
                    console.error('Failed to apply referral:', e)
                }
            }
        }
        if (address) {
            applyReferral()
        }
    }, [address])

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
        const pointsEarned = level === 'easy' ? 3 : level === 'medium' ? 5 : 10
        setStats(prev => ({
            ...prev,
            wins: prev.wins + 1,
            points: prev.points + pointsEarned
        }))

        // Record win to backend
        if (isConnected && address) {
            try {
                const res = await fetch('/api/leaderboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet: address,
                        level,
                        isSupporter
                    })
                })
                const data = await res.json()

                if (data.limitReached) {
                    alert('Daily win limit reached! Come back tomorrow.')
                }

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

    const handleTabChange = useCallback((tab: TabType) => {
        setActiveTab(tab)
    }, [])

    const handlePointsUpdate = useCallback(() => {
        setLeaderboardRefresh(prev => prev + 1)
    }, [])

    // Render content based on active tab
    const renderTabContent = () => {
        switch (activeTab) {
            case 'game':
                return (
                    <>
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
                                <div className="glass-panel" style={{ textAlign: 'center' }}>
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
                            <>
                                <ScratchGame
                                    onWin={handleWin}
                                    onLose={handleLose}
                                />
                                {/* Points Info */}
                                <div className="glass-panel" style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    marginTop: '20px',
                                    fontSize: '12px',
                                    color: '#888',
                                    flexWrap: 'wrap',
                                }}>
                                    <span>🟢 Easy: 3pt</span>
                                    <span>🟡 Medium: 5pt</span>
                                    <span>🔴 Hard: 10pt</span>
                                    <span style={{ color: '#58d8ff' }}>📊 Limit: 10 wins/day</span>
                                </div>
                            </>
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
                    </>
                )

            case 'board':
                return (
                    <>
                        {/* Inline Leaderboard */}
                        <InlineLeaderboard refreshTrigger={leaderboardRefresh} />

                        {/* Quest List */}
                        <QuestList
                            wallet={address || null}
                            isSupporter={isSupporter}
                            onPointsUpdate={handlePointsUpdate}
                        />
                    </>
                )

            case 'profile':
                return (
                    <ProfileTab
                        wallet={address || null}
                        fid={farcasterUser?.fid}
                        username={farcasterUser?.username}
                        pfpUrl={farcasterUser?.pfpUrl}
                    />
                )

            default:
                return null
        }
    }

    return (
        <>
            {/* Background Music */}
            <audio ref={bgmRef} src="/bgm.mp3" loop preload="auto" />

            {/* Navbar with Wallet & Burger Menu */}
            <Navbar
                onMusicToggle={handleMusicToggle}
                isMusicPlaying={isMusicPlaying}
            />

            <main style={{ paddingBottom: '80px', width: '100%', maxWidth: '600px', padding: '0 20px' }}>
                {renderTabContent()}
            </main>

            {/* Bottom Navigation */}
            <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
        </>
    )
}
