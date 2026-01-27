'use client'

import { useState, useEffect } from 'react'

interface ProfileTabProps {
    wallet: string | null
    fid?: number | null
    username?: string | null
    pfpUrl?: string | null
}

interface ProfileData {
    points: {
        game: number
        dailyLogin: number
        supporter: number
        referral: number
        total: number
    }
    stats: {
        easyWins: number
        mediumWins: number
        hardWins: number
        totalWins: number
    }
    referral: {
        code: string | null
        count: number
    }
    isSupporter: boolean
    dailyWinsRemaining: number
}

export default function ProfileTab({ wallet, fid, username, pfpUrl }: ProfileTabProps) {
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [message, setMessage] = useState('')

    useEffect(() => {
        if (wallet) {
            fetchProfile()
        } else {
            setIsLoading(false)
        }
    }, [wallet])

    const fetchProfile = async () => {
        if (!wallet) return
        setIsLoading(true)

        try {
            const res = await fetch(`/api/profile?wallet=${wallet}`)
            if (res.ok) {
                const data = await res.json()
                setProfile({
                    points: data.points,
                    stats: data.stats,
                    referral: data.referral,
                    isSupporter: data.isSupporter,
                    dailyWinsRemaining: data.dailyWinsRemaining
                })
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const copyReferralLink = () => {
        if (profile?.referral.code) {
            navigator.clipboard.writeText(`https://neptuneos-scratch-game.vercel.app?ref=${profile.referral.code}`)
            setMessage('📋 Copied!')
            setTimeout(() => setMessage(''), 2000)
        }
    }

    const shareToWarpcast = () => {
        if (!profile?.referral.code) return
        const shareUrl = `https://neptuneos-scratch-game.vercel.app?ref=${profile.referral.code}`
        const text = `🎮 Play The Scratch Game on Base! Use my referral code: ${profile.referral.code}\n\n${shareUrl}`
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`
        window.open(warpcastUrl, '_blank')
    }

    if (!wallet) {
        return (
            <div style={{
                padding: '40px 20px',
                textAlign: 'center',
            }}>
                <p style={{ fontSize: '48px', marginBottom: '20px' }}>👤</p>
                <h2 style={{ color: '#58d8ff', marginBottom: '10px' }}>Profile</h2>
                <p style={{ color: '#888' }}>Connect wallet to view your profile</p>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div style={{
                padding: '40px 20px',
                textAlign: 'center',
            }}>
                <p style={{ color: '#888' }}>Loading profile...</p>
            </div>
        )
    }

    return (
        <div style={{ padding: '20px' }}>
            {/* User Info */}
            <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '15px',
                border: '1px solid rgba(88, 216, 255, 0.2)',
                textAlign: 'center'
            }}>
                {/* Profile Picture */}
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    margin: '0 auto 12px auto',
                    background: 'rgba(88, 216, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: profile?.isSupporter ? '3px solid #ffd700' : '2px solid rgba(88, 216, 255, 0.4)'
                }}>
                    {pfpUrl ? (
                        <img
                            src={pfpUrl}
                            alt="Profile"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                            onError={(e) => {
                                // Hide image on error and show fallback
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    ) : (
                        <span style={{ fontSize: '40px' }}>
                            {profile?.isSupporter ? '⭐' : '👤'}
                        </span>
                    )}
                </div>

                {username && (
                    <p style={{ color: '#58d8ff', fontWeight: 'bold', fontSize: '18px' }}>
                        @{username}
                    </p>
                )}

                {fid && (
                    <p style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>
                        FID: {fid}
                    </p>
                )}

                <p style={{
                    color: '#666',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    marginTop: '8px'
                }}>
                    {wallet.slice(0, 8)}...{wallet.slice(-6)}
                </p>

                {profile?.isSupporter && (
                    <span style={{
                        display: 'inline-block',
                        background: 'linear-gradient(145deg, #ffd700, #ff8c00)',
                        color: '#111',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        marginTop: '10px'
                    }}>
                        ⭐ Supporter
                    </span>
                )}
            </div>

            {/* Points Breakdown */}
            <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '12px',
                padding: '15px',
                marginBottom: '15px',
                border: '1px solid rgba(88, 216, 255, 0.2)',
            }}>
                <h3 style={{
                    color: '#58d8ff',
                    marginBottom: '15px',
                    fontSize: '14px',
                    textAlign: 'center'
                }}>
                    🏆 Points Breakdown
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: '#aaa' }}>🎮 Game Wins</span>
                        <span style={{ color: '#fff' }}>{profile?.points.game || 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: '#aaa' }}>☀️ Daily Login</span>
                        <span style={{ color: '#fff' }}>{profile?.points.dailyLogin || 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: '#aaa' }}>⭐ Supporter</span>
                        <span style={{ color: '#fff' }}>{profile?.points.supporter || 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: '#aaa' }}>👥 Referral</span>
                        <span style={{ color: '#fff' }}>{profile?.points.referral || 0}</span>
                    </div>

                    <div style={{
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        paddingTop: '10px',
                        marginTop: '5px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }}>
                        <span style={{ color: '#58d8ff' }}>Total</span>
                        <span style={{ color: '#58d8ff' }}>{profile?.points.total || 0}</span>
                    </div>
                </div>
            </div>

            {/* Game Stats */}
            <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '12px',
                padding: '15px',
                marginBottom: '15px',
                border: '1px solid rgba(88, 216, 255, 0.2)',
            }}>
                <h3 style={{
                    color: '#58d8ff',
                    marginBottom: '15px',
                    fontSize: '14px',
                    textAlign: 'center'
                }}>
                    📊 Game Stats
                </h3>

                <div style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    textAlign: 'center'
                }}>
                    <div>
                        <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#4ade80' }}>
                            {profile?.stats.easyWins || 0}
                        </p>
                        <p style={{ fontSize: '11px', color: '#888' }}>Easy</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#facc15' }}>
                            {profile?.stats.mediumWins || 0}
                        </p>
                        <p style={{ fontSize: '11px', color: '#888' }}>Medium</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#f87171' }}>
                            {profile?.stats.hardWins || 0}
                        </p>
                        <p style={{ fontSize: '11px', color: '#888' }}>Hard</p>
                    </div>
                </div>

                <p style={{
                    textAlign: 'center',
                    marginTop: '12px',
                    fontSize: '12px',
                    color: '#888'
                }}>
                    Daily wins remaining: {profile?.dailyWinsRemaining ?? 10}/10
                </p>
            </div>

            {/* Referral Section */}
            <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '12px',
                padding: '15px',
                border: '1px solid rgba(88, 216, 255, 0.2)',
            }}>
                <h3 style={{
                    color: '#58d8ff',
                    marginBottom: '12px',
                    fontSize: '14px',
                    textAlign: 'center'
                }}>
                    👥 Referral
                </h3>

                <p style={{
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#888',
                    marginBottom: '10px'
                }}>
                    Your Code: <span style={{
                        color: '#fff',
                        fontFamily: 'monospace',
                        background: 'rgba(255,255,255,0.1)',
                        padding: '2px 8px',
                        borderRadius: '4px'
                    }}>
                        {profile?.referral.code || 'Generate'}
                    </span>
                </p>

                <p style={{
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#888',
                    marginBottom: '12px'
                }}>
                    Referrals: {profile?.referral.count || 0}/50 ({(profile?.referral.count || 0) * 10} pts)
                </p>

                {message && (
                    <p style={{
                        textAlign: 'center',
                        fontSize: '12px',
                        color: '#4ade80',
                        marginBottom: '10px'
                    }}>
                        {message}
                    </p>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                        onClick={copyReferralLink}
                        style={{
                            padding: '10px 20px',
                            fontSize: '13px',
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        📋 Copy
                    </button>
                    <button
                        onClick={shareToWarpcast}
                        style={{
                            padding: '10px 20px',
                            fontSize: '13px',
                            background: 'linear-gradient(145deg, #8b5cf6, #6d28d9)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        📤 Share
                    </button>
                </div>
            </div>
        </div>
    )
}
