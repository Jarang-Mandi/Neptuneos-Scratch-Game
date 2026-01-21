'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi'
import { base } from 'wagmi/chains'
import { sdk } from '@farcaster/miniapp-sdk'

interface FarcasterUser {
    fid: number
    username?: string
    displayName?: string
    pfpUrl?: string
}

export default function WalletConnect() {
    const { isConnected, address } = useAccount()
    const chainId = useChainId()
    const { connect, connectors, isPending } = useConnect()
    const { disconnect } = useDisconnect()
    const [showModal, setShowModal] = useState(false)
    const [farcasterUser, setFarcasterUser] = useState<FarcasterUser | null>(null)
    const [isInMiniApp, setIsInMiniApp] = useState(false)

    // Load Farcaster user context
    useEffect(() => {
        const loadFarcasterUser = async () => {
            try {
                const miniAppStatus = await sdk.isInMiniApp()
                setIsInMiniApp(miniAppStatus)

                if (miniAppStatus) {
                    const context = await sdk.context
                    if (context?.user) {
                        setFarcasterUser({
                            fid: context.user.fid,
                            username: context.user.username,
                            displayName: context.user.displayName,
                            pfpUrl: context.user.pfpUrl,
                        })
                    }
                }
            } catch (error) {
                console.log('Not in Farcaster Mini App context')
            }
        }

        loadFarcasterUser()
    }, [isConnected])

    // Auto-connect Farcaster on mount
    useEffect(() => {
        if (!isConnected && connectors.length > 0) {
            const firstConnector = connectors[0]
            if (firstConnector) {
                connect({ connector: firstConnector })
            }
        }
    }, [connectors, isConnected, connect])

    const handleConnect = (connector: any) => {
        connect({ connector })
        setShowModal(false)
    }

    // Wallet info mapping
    const getWalletInfo = (index: number) => {
        const wallets = [
            { name: 'Farcaster', icon: '🟣', color: '#8a63d2' },
            { name: 'MetaMask', icon: '🦊', color: '#f6851b' },
            { name: 'OKX Wallet', icon: '⚫', color: '#000000' },
        ]
        return wallets[index] || { name: 'Browser Wallet', icon: '🌐', color: '#666' }
    }

    // Get network name
    const getNetworkName = () => {
        if (chainId === base.id) return 'Base'
        if (chainId === 1) return 'Ethereum'
        return `Chain ${chainId}`
    }

    if (isConnected) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '6px 12px',
                borderRadius: '12px',
                border: '1px solid rgba(88, 216, 255, 0.2)',
            }}>
                {/* Farcaster Profile Picture */}
                {farcasterUser?.pfpUrl ? (
                    <img
                        src={farcasterUser.pfpUrl}
                        alt="Profile"
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            border: '2px solid #8a63d2',
                        }}
                    />
                ) : (
                    <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #8a63d2, #58d8ff)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                    }}>
                        🔗
                    </div>
                )}

                {/* User Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {/* Display Name or Username */}
                    {farcasterUser ? (
                        <span style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#fff',
                        }}>
                            {farcasterUser.displayName || `@${farcasterUser.username}`}
                        </span>
                    ) : (
                        <span style={{
                            fontSize: '11px',
                            color: '#58d8ff',
                            fontFamily: 'monospace',
                        }}>
                            {address?.slice(0, 6)}...{address?.slice(-4)}
                        </span>
                    )}

                    {/* FID or Network */}
                    <span style={{
                        fontSize: '10px',
                        color: farcasterUser ? '#8a63d2' : chainId === base.id ? '#58d8ff' : '#ff6b6b',
                    }}>
                        {farcasterUser ? `FID: ${farcasterUser.fid}` : getNetworkName()}
                    </span>
                </div>

                {/* Disconnect button */}
                <button
                    onClick={() => disconnect()}
                    style={{
                        fontSize: '11px',
                        padding: '4px 8px',
                        background: 'transparent',
                        border: '1px solid rgba(255, 107, 107, 0.4)',
                        color: '#ff6b6b',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        marginLeft: '4px',
                    }}
                >
                    ✕
                </button>
            </div>
        )
    }

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                disabled={isPending}
                style={{ fontSize: '13px', padding: '8px 16px' }}
            >
                {isPending ? '⏳ Connecting...' : '🔗 Connect'}
            </button>

            {/* Wallet Selection Modal */}
            {showModal && (
                <div
                    className="popup-overlay"
                    onClick={() => setShowModal(false)}
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <div
                        className="popup-content"
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: '400px',
                            width: '90%',
                            margin: 'auto',
                        }}
                    >
                        <button className="popup-close" onClick={() => setShowModal(false)}>✖</button>
                        <h2 style={{ color: '#58d8ff', marginBottom: '20px', textAlign: 'center' }}>
                            Connect Wallet
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {connectors.slice(0, 3).map((connector, index) => {
                                const { name, icon, color } = getWalletInfo(index)

                                return (
                                    <button
                                        key={index}
                                        onClick={() => handleConnect(connector)}
                                        disabled={isPending}
                                        style={{
                                            padding: '16px 20px',
                                            fontSize: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            textAlign: 'left',
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: `2px solid ${color}33`,
                                            borderRadius: '12px',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = `${color}22`
                                            e.currentTarget.style.borderColor = color
                                            e.currentTarget.style.transform = 'translateX(5px)'
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                                            e.currentTarget.style.borderColor = `${color}33`
                                            e.currentTarget.style.transform = 'translateX(0)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ fontSize: '28px' }}>{icon}</span>
                                            <span style={{ fontWeight: 'bold' }}>{name}</span>
                                        </div>
                                        <span style={{ fontSize: '24px', opacity: 0.5 }}>→</span>
                                    </button>
                                )
                            })}

                            {connectors.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <p style={{ marginBottom: '15px', color: '#aaa' }}>
                                        No wallet detected
                                    </p>
                                    <button
                                        onClick={() => window.open('https://metamask.io/download/', '_blank')}
                                        style={{ padding: '15px 20px', fontSize: '16px' }}
                                    >
                                        🦊 Install MetaMask
                                    </button>
                                </div>
                            )}
                        </div>

                        <p style={{
                            fontSize: '12px',
                            color: '#888',
                            marginTop: '20px',
                            textAlign: 'center',
                            lineHeight: '1.5'
                        }}>
                            🟣 Farcaster | 🦊 MetaMask | ⚫ OKX Wallet
                        </p>
                    </div>
                </div>
            )}
        </>
    )
}
