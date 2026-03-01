'use client'

import { useState, useEffect } from 'react'
import { sanitizeImageUrl, sanitizeDisplayText } from '@/lib/sanitize'

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
    isGTD: boolean
    dailyWinsRemaining: number
}

export default function ProfileTab({ wallet, fid, username, pfpUrl }: ProfileTabProps) {
    const safePfpUrl = sanitizeImageUrl(pfpUrl)
    const safeUsername = sanitizeDisplayText(username, 30)
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
                    isGTD: data.isGTD,
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
        <div style={{ marginTop: '20px' }}>
            {/* User Info */}
            <div className="glass-panel" style={{ textAlign: 'center' }}>
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
                    {safePfpUrl ? (
                        <img
                            src={safePfpUrl}
                            alt="Profile"
                            referrerPolicy="no-referrer"
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

                {safeUsername && (
                    <p style={{ color: '#58d8ff', fontWeight: 'bold', fontSize: '18px' }}>
                        @{safeUsername}
                    </p>
                )}

                {fid && (
                    <p style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>
                        FID: {fid}
                    </p>
                )}

                <p className="wallet-addr" style={{
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

                {profile?.isGTD && (
                    <span style={{
                        display: 'inline-block',
                        background: 'linear-gradient(145deg, #00d2ff, #3a7bd5)',
                        color: '#fff',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        marginTop: '10px',
                        marginLeft: profile?.isSupporter ? '6px' : '0'
                    }}>
                        🎫 GTD WL
                    </span>
                )}
            </div>

            {/* Points Breakdown */}
            <div className="glass-panel">
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
                        <span className="points-label" style={{ color: '#aaa' }}>🎮 Game Wins</span>
                        <span className="points-value" style={{ color: '#fff' }}>{profile?.points.game || 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span className="points-label" style={{ color: '#aaa' }}>☀️ Daily Login</span>
                        <span className="points-value" style={{ color: '#fff' }}>{profile?.points.dailyLogin || 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span className="points-label" style={{ color: '#aaa' }}>⭐ Supporter</span>
                        <span className="points-value" style={{ color: '#fff' }}>{profile?.points.supporter || 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span className="points-label" style={{ color: '#aaa' }}>👥 Referral</span>
                        <span className="points-value" style={{ color: '#fff' }}>{profile?.points.referral || 0}</span>
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
                        <span className="points-value" style={{ color: '#58d8ff' }}>Total</span>
                        <span className="points-value" style={{ color: '#58d8ff' }}>{profile?.points.total || 0}</span>
                    </div>
                </div>
            </div>

            {/* Game Stats */}
            <div className="glass-panel">
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
                        <p className="stat-value-easy" style={{ fontSize: '20px', fontWeight: 'bold', color: '#4ade80' }}>
                            {profile?.stats.easyWins || 0}
                        </p>
                        <p className="points-label" style={{ fontSize: '11px', color: '#888' }}>Easy</p>
                    </div>
                    <div>
                        <p className="stat-value-medium" style={{ fontSize: '20px', fontWeight: 'bold', color: '#facc15' }}>
                            {profile?.stats.mediumWins || 0}
                        </p>
                        <p className="points-label" style={{ fontSize: '11px', color: '#888' }}>Medium</p>
                    </div>
                    <div>
                        <p className="stat-value-hard" style={{ fontSize: '20px', fontWeight: 'bold', color: '#f87171' }}>
                            {profile?.stats.hardWins || 0}
                        </p>
                        <p className="points-label" style={{ fontSize: '11px', color: '#888' }}>Hard</p>
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
        </div>
    )
}
