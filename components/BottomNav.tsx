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
            height: '60px',
            background: 'rgba(15, 32, 39, 0.95)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid rgba(88, 216, 255, 0.2)',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            zIndex: 1000,
            padding: '0 20px',
        }}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    style={{
                        background: activeTab === tab.id ? 'rgba(88, 216, 255, 0.15)' : 'transparent',
                        border: 'none',
                        padding: '8px 20px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        transition: 'all 0.3s ease',
                        opacity: activeTab === tab.id ? 1 : 0.6,
                        borderRadius: '16px',
                        minWidth: '70px',
                        transform: activeTab === tab.id ? 'translateY(-2px)' : 'none',
                    }}
                    aria-label={tab.label}
                >
                    <span style={{
                        fontSize: '22px',
                        filter: activeTab === tab.id
                            ? 'drop-shadow(0 0 5px rgba(88, 216, 255, 0.6))'
                            : 'none',
                        transition: 'filter 0.3s ease',
                    }}>
                        {tab.icon}
                    </span>
                    <span style={{
                        fontSize: '11px',
                        fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                        color: activeTab === tab.id ? '#58d8ff' : '#aaa',
                    }}>
                        {tab.label}
                    </span>
                </button>
            ))}
        </nav>
    )
}
