'use client'

import { useState, useEffect } from 'react'

type TabType = 'game' | 'board' | 'profile'

interface BottomNavProps {
    activeTab: TabType
    onTabChange: (tab: TabType) => void
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
    const tabs: { id: TabType; icon: string; label: string }[] = [
        { id: 'game', icon: '🎮', label: 'Game' },
        { id: 'board', icon: '🏆', label: 'Board' },
        { id: 'profile', icon: '👤', label: 'Me' }
    ]

    return (
        <nav style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '70px',
            background: 'rgba(15, 32, 39, 0.95)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid rgba(88, 216, 255, 0.2)',
            display: 'flex',
            justifyContent: 'center',
            gap: '15px',
            alignItems: 'center',
            zIndex: 1000,
            padding: '0 20px',
        }}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        style={{
                            background: isActive ? 'rgba(88, 216, 255, 0.15)' : 'transparent',
                            border: '1px solid rgba(88, 216, 255, 0.3)',
                            padding: isActive ? '10px 20px' : '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
                            opacity: isActive ? 1 : 0.6,
                            borderRadius: '30px',
                            minWidth: isActive ? '100px' : '50px',
                        }}
                        aria-label={tab.label}
                    >
                        <span style={{
                            fontSize: '22px',
                            filter: isActive
                                ? 'drop-shadow(0 0 5px rgba(88, 216, 255, 0.6))'
                                : 'grayscale(100%)',
                            transition: 'filter 0.3s ease',
                        }}>
                            {tab.icon}
                        </span>
                        
                        <span style={{
                            fontSize: '14px',
                            fontWeight: 'bold',
                            color: '#58d8ff',
                            display: isActive ? 'block' : 'none',
                            whiteSpace: 'nowrap',
                            animation: isActive ? 'fadeIn 0.3s forwards' : 'none'
                        }}>
                            {tab.label}
                        </span>
                    </button>
                )
            })}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateX(-5px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </nav>
    )
}
