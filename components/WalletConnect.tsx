'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

export default function WalletConnect() {
    const { isConnected, address } = useAccount()
    const { connect, connectors, isPending } = useConnect()
    const { disconnect } = useDisconnect()
    const [showModal, setShowModal] = useState(false)

    // Auto-connect Farcaster on mount
    useEffect(() => {
        if (!isConnected && connectors.length > 0) {
            // Try Farcaster first (index 0 based on wagmi config)
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

    // Simplified: Just use index-based naming since we know the order from wagmi config
    // wagmi config order: [farcasterMiniApp(), injected({ target: 'metaMask' })]
    const getWalletInfo = (index: number) => {
        if (index === 0) {
            return { name: 'Farcaster', icon: '🟣', color: '#8a63d2' }
        }
        if (index === 1) {
            return { name: 'MetaMask', icon: '🦊', color: '#f6851b' }
        }
        return { name: 'Browser Wallet', icon: '🌐', color: '#666' }
    }

    if (isConnected) {
        return (
            <div className="wallet-section">
                <div className="wallet-address" style={{ fontSize: '14px', marginBottom: '8px' }}>
                    🔗 {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
                <button
                    onClick={() => disconnect()}
                    style={{
                        fontSize: '12px',
                        padding: '6px 12px',
                        background: 'linear-gradient(145deg, #ff6b6b, #cc0000)',
                    }}
                >
                    Disconnect
                </button>
            </div>
        )
    }

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                disabled={isPending}
                style={{ fontSize: '14px', padding: '10px 20px' }}
            >
                {isPending ? '⏳ Connecting...' : '🔗 Connect Wallet'}
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
                            {connectors.slice(0, 2).map((connector, index) => {
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

                            {/* No wallets detected */}
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
                            🟣 Farcaster users auto-connect | 🦊 MetaMask for testing
                        </p>
                    </div>
                </div>
            )}
        </>
    )
}
