'use client'

import { useState, useEffect } from 'react'

interface QuestListProps {
    wallet: string | null
    isSupporter: boolean
    onPointsUpdate?: () => void
}

export default function QuestList({ wallet, isSupporter, onPointsUpdate }: QuestListProps) {
    const [dailyLoginStatus, setDailyLoginStatus] = useState<{
        canClaim: boolean
        cooldownRemaining: number
        totalPoints: number
    }>({ canClaim: false, cooldownRemaining: 0, totalPoints: 0 })

    const [referralData, setReferralData] = useState<{
        code: string
        count: number
        points: number
    }>({ code: '', count: 0, points: 0 })

    const [supporterBonus, setSupporterBonus] = useState<{
        claimed: boolean
        canClaim: boolean
    }>({ claimed: false, canClaim: false })

    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => {
        if (wallet) {
            fetchQuestData()
        }
    }, [wallet])

    const fetchQuestData = async () => {
        if (!wallet) return

        try {
            // Fetch daily login status
            const loginRes = await fetch(`/api/quest/daily-login?wallet=${wallet}`)
            if (loginRes.ok) {
                const data = await loginRes.json()
                setDailyLoginStatus({
                    canClaim: data.canClaim,
                    cooldownRemaining: data.cooldownRemaining,
                    totalPoints: data.totalDailyLoginPoints
                })
            }

            // Fetch referral data
            const refRes = await fetch(`/api/quest/referral?wallet=${wallet}`)
            if (refRes.ok) {
                const data = await refRes.json()
                setReferralData({
                    code: data.referralCode,
                    count: data.referralCount,
                    points: data.referralPoints
                })
            }

            // Fetch profile for supporter bonus status
            const profileRes = await fetch(`/api/profile?wallet=${wallet}`)
            if (profileRes.ok) {
                const data = await profileRes.json()
                setSupporterBonus({
                    claimed: data.supporterBonusClaimed,
                    canClaim: data.canClaimSupporterBonus
                })
            }
        } catch (error) {
            console.error('Failed to fetch quest data:', error)
        }
    }

    const claimDailyLogin = async () => {
        if (!wallet || isLoading) return
        setIsLoading(true)
        setMessage('')

        try {
            const res = await fetch('/api/quest/daily-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet })
            })
            const data = await res.json()

            if (data.success) {
                setMessage(`✅ ${data.message}`)
                fetchQuestData()
                onPointsUpdate?.()
            } else {
                setMessage(`❌ ${data.error}`)
            }
        } catch (error) {
            setMessage('❌ Failed to claim')
        } finally {
            setIsLoading(false)
        }
    }

    const claimSupporterBonus = async () => {
        if (!wallet || isLoading) return
        setIsLoading(true)
        setMessage('')

        try {
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet, action: 'claim_supporter_bonus' })
            })
            const data = await res.json()

            if (data.success) {
                setMessage(`✅ ${data.message}`)
                fetchQuestData()
                onPointsUpdate?.()
            } else {
                setMessage(`❌ ${data.error}`)
            }
        } catch (error) {
            setMessage('❌ Failed to claim')
        } finally {
            setIsLoading(false)
        }
    }

    const copyReferralCode = () => {
        if (referralData.code) {
            navigator.clipboard.writeText(`https://neptuneos-scratch-game.vercel.app?ref=${referralData.code}`)
            setMessage('📋 Referral link copied!')
            setTimeout(() => setMessage(''), 2000)
        }
    }

    const shareToWarpcast = () => {
        const shareUrl = `https://neptuneos-scratch-game.vercel.app?ref=${referralData.code}`
        const text = `🎮 Play The Scratch Game on Base! Use my referral code: ${referralData.code}\n\n${shareUrl}`
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`
        window.open(warpcastUrl, '_blank')
    }

    const formatCooldown = (ms: number): string => {
        const hours = Math.floor(ms / (1000 * 60 * 60))
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
        return `${hours}h ${minutes}m`
    }

    if (!wallet) {
        return (
            <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '12px',
                padding: '20px',
                marginTop: '15px',
                border: '1px solid rgba(88, 216, 255, 0.2)',
                maxWidth: '340px',
                margin: '15px auto 0',
            }}>
                <h3 style={{ color: '#58d8ff', marginBottom: '10px', fontSize: '16px' }}>
                    📋 Quests
                </h3>
                <p style={{ color: '#888', fontSize: '13px' }}>
                    Connect wallet to view quests
                </p>
            </div>
        )
    }

    return (
        <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            padding: '15px',
            marginTop: '15px',
            border: '1px solid rgba(88, 216, 255, 0.2)',
            maxWidth: '340px',
            margin: '15px auto 0',
        }}>
            <h3 style={{ color: '#58d8ff', marginBottom: '15px', fontSize: '16px', textAlign: 'center' }}>
                📋 Quests
            </h3>

            {message && (
                <p style={{
                    background: 'rgba(88, 216, 255, 0.1)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    fontSize: '12px',
                    textAlign: 'center'
                }}>
                    {message}
                </p>
            )}

            {/* Daily Login */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                marginBottom: '8px'
            }}>
                <div>
                    <span style={{ fontSize: '14px' }}>☀️ Daily Login</span>
                    <span style={{
                        marginLeft: '8px',
                        color: '#58d8ff',
                        fontSize: '12px'
                    }}>+2 pts</span>
                </div>
                <button
                    onClick={claimDailyLogin}
                    disabled={!dailyLoginStatus.canClaim || isLoading}
                    style={{
                        padding: '6px 16px',
                        fontSize: '12px',
                        background: dailyLoginStatus.canClaim
                            ? 'linear-gradient(145deg, #00c6ff, #0072ff)'
                            : 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        cursor: dailyLoginStatus.canClaim ? 'pointer' : 'default',
                        opacity: dailyLoginStatus.canClaim ? 1 : 0.6
                    }}
                >
                    {dailyLoginStatus.canClaim
                        ? 'Claim'
                        : formatCooldown(dailyLoginStatus.cooldownRemaining)}
                </button>
            </div>

            {/* Supporter Bonus */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px',
                background: 'rgba(255,215,0,0.05)',
                borderRadius: '8px',
                marginBottom: '8px'
            }}>
                <div>
                    <span style={{ fontSize: '14px' }}>⭐ Supporter</span>
                    <span style={{
                        marginLeft: '8px',
                        color: '#ffd700',
                        fontSize: '12px'
                    }}>+50 pts</span>
                </div>
                {supporterBonus.claimed ? (
                    <span style={{ color: '#4ade80', fontSize: '12px' }}>✅ Claimed</span>
                ) : supporterBonus.canClaim ? (
                    <button
                        onClick={claimSupporterBonus}
                        disabled={isLoading}
                        style={{
                            padding: '6px 16px',
                            fontSize: '12px',
                            background: 'linear-gradient(145deg, #ffd700, #ff8c00)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#111',
                            cursor: 'pointer'
                        }}
                    >
                        Claim
                    </button>
                ) : (
                    <span style={{ color: '#888', fontSize: '12px' }}>
                        {isSupporter ? 'Pending' : 'Donate $1'}
                    </span>
                )}
            </div>

            {/* Referral */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
            }}>
                <div>
                    <span style={{ fontSize: '14px' }}>👥 Invite ({referralData.count}/50)</span>
                    <span style={{
                        marginLeft: '8px',
                        color: '#58d8ff',
                        fontSize: '12px'
                    }}>+10 pts/ea</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={copyReferralCode}
                        style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        📋
                    </button>
                    <button
                        onClick={shareToWarpcast}
                        style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            background: 'linear-gradient(145deg, #8b5cf6, #6d28d9)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        Share
                    </button>
                </div>
            </div>
        </div>
    )
}
