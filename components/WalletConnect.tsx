'use client'

import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

export default function WalletConnect() {
    const { isConnected, address } = useAccount()
    const { connect, connectors, isPending } = useConnect()
    const { disconnect } = useDisconnect()
    const [showModal, setShowModal] = useState(false)

    const handleConnect = (connector: any) => {
        connect({ connector })
        setShowModal(false)
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
                <div className="popup-overlay" onClick={() => setShowModal(false)}>
                    <div className="popup-content" onClick={e => e.stopPropagation()}>
                        <button className="popup-close" onClick={() => setShowModal(false)}>✖</button>
                        <h2 style={{ color: '#58d8ff', marginBottom: '20px' }}>Select Wallet</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {connectors.map((connector, index) => {
                                // Get wallet name from connector
                                const getName = () => {
                                    const connectorStr = String(connector)
                                    if (connectorStr.includes('metaMask') || connectorStr.includes('MetaMask')) return '🦊 MetaMask'
                                    if (connectorStr.includes('coinbase') || connectorStr.includes('Coinbase')) return '🔵 Coinbase Wallet'
                                    if (connectorStr.includes('walletConnect') || connectorStr.includes('WalletConnect')) return '🌐 WalletConnect'
                                    return `Wallet ${index + 1}`
                                }

                                return (
                                    <button
                                        key={index}
                                        onClick={() => handleConnect(connector)}
                                        disabled={isPending}
                                        style={{
                                            padding: '15px',
                                            fontSize: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            textAlign: 'left',
                                        }}
                                    >
                                        <span>{getName()}</span>
                                        <span style={{ fontSize: '20px' }}>→</span>
                                    </button>
                                )
                            })}

                            {/* No wallets detected */}
                            {connectors.length === 0 && (
                                <button
                                    onClick={() => window.open('https://metamask.io/download/', '_blank')}
                                    style={{ padding: '15px', fontSize: '16px' }}
                                >
                                    🦊 Install MetaMask
                                </button>
                            )}
                        </div>

                        <p style={{ fontSize: '12px', color: '#888', marginTop: '15px', textAlign: 'center' }}>
                            Connect your wallet to play and track scores
                        </p>
                    </div>
                </div>
            )}
        </>
    )
}
