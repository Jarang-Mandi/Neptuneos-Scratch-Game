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
import { useAuth } from '@/lib/useAuth'
import { sanitizeReferralCode, sanitizeImageUrl, sanitizeDisplayText } from '@/lib/sanitize'

// Contract ABI for checking supporter status
const donationAbi = parseAbi([
    'function isSupporter(address) view returns (bool)',
])

type TabType = 'game' | 'board' | 'profile'

export default function Home() {
    const { address, isConnected } = useAccount()
    const { isAuthenticated, isAuthenticating, authError, login, retryLogin, authFetch, getAuthHeaders } = useAuth()
    const [isSupporter, setIsSupporter] = useState(false)
    const [stats, setStats] = useState({ wins: 0, losses: 0, points: 0 })
    const [leaderboardRefresh, setLeaderboardRefresh] = useState(0)
    const [isMusicPlaying, setIsMusicPlaying] = useState(false)
    const [activeTab, setActiveTab] = useState<TabType>('game')
    const [farcasterUser, setFarcasterUser] = useState<{ fid?: number; username?: string; pfpUrl?: string } | null>(null)
    const bgmRef = useRef<HTMLAudioElement>(null)

    // Auto-login when wallet connects and not yet authenticated
    useEffect(() => {
        if (isConnected && address && !isAuthenticated && !isAuthenticating) {
            login()
        }
    }, [isConnected, address, isAuthenticated, isAuthenticating, login])

    // Get Farcaster context (sanitise untrusted external data)
    useEffect(() => {
        const initFarcaster = async () => {
            try {
                const context = await sdk.context
                if (context?.user) {
                    setFarcasterUser({
                        fid: context.user.fid,
                        username: sanitizeDisplayText(context.user.username, 30) || undefined,
                        pfpUrl: sanitizeImageUrl(context.user.pfpUrl) || undefined
                    })
                }
            } catch (e) {
                // Not in Farcaster context
            }
        }
        initFarcaster()
    }, [])

    // Check for referral code in URL — sanitise before storing
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const refCode = sanitizeReferralCode(urlParams.get('ref'))
        if (refCode && address) {
            localStorage.setItem('pendingReferral', refCode)
        }
    }, [address])

    // Apply pending referral when wallet connects AND authenticated
    useEffect(() => {
        const applyReferral = async () => {
            const rawRef = localStorage.getItem('pendingReferral')
            const pendingRef = sanitizeReferralCode(rawRef)
            if (pendingRef && address && isAuthenticated) {
                try {
                    const res = await authFetch('/api/quest/referral', {
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
        if (address && isAuthenticated) {
            applyReferral()
        }
    }, [address, isAuthenticated, authFetch])

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

    // Win is already recorded server-side by /api/game/reveal
    // This callback only updates local UI state
    const handleWin = useCallback((level: string, pointsEarned?: number, dailyWinsRemaining?: number) => {
        setStats(prev => ({
            ...prev,
            wins: prev.wins + 1,
            points: prev.points + (pointsEarned || 0)
        }))

        if (dailyWinsRemaining !== undefined && dailyWinsRemaining <= 0) {
            alert('Daily win limit reached! Come back tomorrow.')
        }

        // Refresh leaderboard (win already recorded server-side)
        setLeaderboardRefresh(prev => prev + 1)
    }, [])

    const handleLose = useCallback(() => {
        setStats(prev => ({ ...prev, losses: prev.losses + 1 }))
    }, [])

    const handleDonateSuccess = useCallback(async () => {
        setIsSupporter(true)

        // Record supporter status to backend (authenticated)
        if (address && isAuthenticated) {
            try {
                await authFetch('/api/donate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ wallet: address })
                })
            } catch (error) {
                console.error('Failed to record donation:', error)
            }
        }
    }, [address, isAuthenticated, authFetch])

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

                        {/* Auth Status */}
                        {isConnected && !isAuthenticated && (
                            <div style={{
                                textAlign: 'center',
                                padding: '15px',
                                marginBottom: '15px',
                                background: 'rgba(255, 200, 50, 0.1)',
                                borderRadius: '12px',
                                border: '1px solid rgba(255, 200, 50, 0.3)',
                            }}>
                                {isAuthenticating ? (
                                    <p style={{ color: '#ffc832', fontSize: '14px' }}>⏳ Please sign the message in your wallet to authenticate...</p>
                                ) : authError ? (
                                    <>
                                        <p style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '8px' }}>❌ {authError}</p>
                                        <button
                                            onClick={() => { retryLogin(); login() }}
                                            style={{
                                                padding: '8px 16px',
                                                background: 'linear-gradient(145deg, #00c6ff, #0072ff)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: 'white',
                                                cursor: 'pointer',
                                                fontSize: '13px'
                                            }}
                                        >
                                            🔑 Retry Sign-In
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => { retryLogin(); login() }}
                                        style={{
                                            padding: '10px 20px',
                                            background: 'linear-gradient(145deg, #00c6ff, #0072ff)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        🔑 Sign In to Play
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Connected User Section */}
                        {isConnected && (
                            <>
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
                                    wallet={address}
                                    getAuthHeaders={getAuthHeaders}
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
                    <div className="container" style={{ marginTop: '20px' }}>
                        {/* Inline Leaderboard */}
                        <InlineLeaderboard refreshTrigger={leaderboardRefresh} />

                        {/* Donation Section */}
                        {isConnected && (
                            <div className="glass-panel" style={{ textAlign: 'center' }}>
                                <DonateButton
                                    isSupporter={isSupporter}
                                    onDonateSuccess={handleDonateSuccess}
                                    getAuthHeaders={getAuthHeaders}
                                />
                            </div>
                        )}

                        {/* Quest List */}
                        <QuestList
                            wallet={address || null}
                            isSupporter={isSupporter}
                            onPointsUpdate={handlePointsUpdate}
                            getAuthHeaders={getAuthHeaders}
                        />
                    </div>
                )

            case 'profile':
                return (
                    <div className="container" style={{ marginTop: '20px' }}>
                        <ProfileTab
                            wallet={address || null}
                            fid={farcasterUser?.fid}
                            username={farcasterUser?.username}
                            pfpUrl={farcasterUser?.pfpUrl}
                        />
                    </div>
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

            <main style={{ paddingBottom: '80px', width: '100%', maxWidth: '600px', padding: '20px 16px', margin: '0 auto', boxSizing: 'border-box' }}>
                {renderTabContent()}
            </main>

            {/* Bottom Navigation */}
            <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
        </>
    )
}
