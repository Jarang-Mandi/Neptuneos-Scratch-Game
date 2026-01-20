'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from '@/lib/wagmi'
import { useState, useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
    const [isSDKReady, setIsSDKReady] = useState(false)

    useEffect(() => {
        // Initialize Farcaster Mini App SDK
        const initSDK = async () => {
            try {
                await sdk.actions.ready()
                setIsSDKReady(true)
            } catch (error) {
                console.warn('Farcaster SDK not available (running outside Farcaster):', error)
                setIsSDKReady(true) // Continue anyway for development
            }
        }
        initSDK()
    }, [])

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}
