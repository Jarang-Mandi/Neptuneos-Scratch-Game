'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'

export default function WalletConnect() {
    const { isConnected, address } = useAccount()
    const { connect, connectors, isPending } = useConnect()
    const { disconnect } = useDisconnect()

    if (isConnected) {
        return (
            <div className="wallet-section">
                <div className="wallet-address">
                    🔗 {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
                <button
                    onClick={() => disconnect()}
                    style={{ fontSize: '12px', padding: '5px 10px', marginTop: '5px' }}
                >
                    Disconnect
                </button>
            </div>
        )
    }

    return (
        <div className="wallet-section">
            <button
                onClick={() => connect({ connector: connectors[0] })}
                disabled={isPending}
            >
                {isPending ? '⏳ Connecting...' : '🔗 Connect Wallet'}
            </button>
        </div>
    )
}
