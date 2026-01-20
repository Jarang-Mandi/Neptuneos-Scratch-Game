import { base } from 'wagmi/chains'
import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'

export const config = createConfig({
    chains: [base],
    transports: {
        [base.id]: http(),
    },
    connectors: [
        farcasterMiniApp(), // Priority: Farcaster auto-connect
        injected({ target: 'metaMask' }), // MetaMask
        injected({
            target: {
                id: 'okxwallet',
                name: 'OKX Wallet',
                provider: (window) => {
                    // @ts-ignore
                    return window?.okxwallet
                }
            }
        }), // OKX Wallet
    ],
})

// USDC on Base Mainnet
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

// Donation amount: $1 USDC (6 decimals)
export const DONATION_AMOUNT = 1_000_000n // $1 USDC

// Smart Contract Address - dari environment variable
export const DONATION_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_GAME_CONTRACT || '0x0000000000000000000000000000000000000000') as `0x${string}`
