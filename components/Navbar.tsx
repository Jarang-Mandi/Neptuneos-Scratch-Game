'use client'

import { useState, useEffect, useRef } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { base } from 'wagmi/chains'
import WalletConnect from './WalletConnect'

interface NavbarProps {
    onMusicToggle?: () => void
    isMusicPlaying?: boolean
}

export default function Navbar({ onMusicToggle, isMusicPlaying = false }: NavbarProps) {
    const { isConnected, address } = useAccount()
    const chainId = useChainId()
    const [menuOpen, setMenuOpen] = useState(false)
    const [isLightMode, setIsLightMode] = useState(false)

    // Initialize theme from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('theme') || 'dark'
        setIsLightMode(saved === 'light')
        if (saved === 'light') {
            document.body.classList.add('light-mode')
        }
    }, [])

    const toggleTheme = () => {
        const newMode = !isLightMode
        setIsLightMode(newMode)
        if (newMode) {
            document.body.classList.add('light-mode')
            localStorage.setItem('theme', 'light')
        } else {
            document.body.classList.remove('light-mode')
            localStorage.setItem('theme', 'dark')
        }
    }

    return (
        <nav className="navbar">
            {/* Logo */}
            <div className="navbar-brand">
                <img src="/icon.png" alt="Logo" style={{ width: 32, height: 32, borderRadius: 6 }} />
                <span className="navbar-title">The Scratch Game</span>
            </div>

            {/* Right side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Wallet Connect */}
                <WalletConnect />

                {/* Burger Menu Button */}
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}
                >
                    ☰
                </button>

                {/* Dropdown Menu */}
                {menuOpen && (
                    <div style={{
                        position: 'absolute',
                        top: '60px',
                        right: '15px',
                        background: 'rgba(20, 30, 50, 0.98)',
                        border: '1px solid rgba(88, 216, 255, 0.3)',
                        borderRadius: '12px',
                        padding: '15px',
                        minWidth: '180px',
                        zIndex: 1000,
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    }}>
                        {/* Music Toggle */}
                        <button
                            onClick={() => {
                                onMusicToggle?.()
                                setMenuOpen(false)
                            }}
                            style={{
                                width: '100%',
                                padding: '12px',
                                marginBottom: '8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '14px',
                            }}
                        >
                            {isMusicPlaying ? '🔊' : '🔇'}
                            <span>{isMusicPlaying ? 'Music On' : 'Music Off'}</span>
                        </button>

                        {/* Theme Toggle */}
                        <button
                            onClick={() => {
                                toggleTheme()
                                setMenuOpen(false)
                            }}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '14px',
                            }}
                        >
                            {isLightMode ? '🌙' : '☀️'}
                            <span>{isLightMode ? 'Dark Mode' : 'Light Mode'}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Overlay to close menu */}
            {menuOpen && (
                <div
                    onClick={() => setMenuOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 999,
                    }}
                />
            )}
        </nav>
    )
}
