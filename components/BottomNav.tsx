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
                        background: 'transparent',
                        border: 'none',
                        padding: '10px 30px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'transform 0.2s, opacity 0.2s',
                        opacity: activeTab === tab.id ? 1 : 0.5,
                        transform: activeTab === tab.id ? 'scale(1.1)' : 'scale(1)',
                    }}
                    aria-label={tab.label}
                >
                    <span style={{
                        fontSize: '24px',
                        filter: activeTab === tab.id
                            ? 'drop-shadow(0 0 8px rgba(88, 216, 255, 0.8))'
                            : 'none',
                    }}>
                        {tab.icon}
                    </span>
                    {activeTab === tab.id && (
                        <div style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            background: '#58d8ff',
                            marginTop: '2px',
                        }} />
                    )}
                </button>
            ))}
        </nav>
    )
}
