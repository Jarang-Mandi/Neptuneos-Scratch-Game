'use client'

import WalletConnect from './WalletConnect'

export default function Navbar() {
    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <span className="navbar-logo">🎮</span>
                <span className="navbar-title">Scratch Game</span>
            </div>
            <div className="navbar-wallet">
                <WalletConnect />
            </div>
        </nav>
    )
}
