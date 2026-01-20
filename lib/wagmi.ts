import { base } from 'wagmi/chains'
import { http, createConfig } from 'wagmi'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'

// WalletConnect Project ID (optional - get from https://cloud.walletconnect.com/)
const projectId = 'YOUR_PROJECT_ID' // TODO: Replace with actual project ID or remove walletConnect

export const config = createConfig({
    chains: [base],
    transports: {
        [base.id]: http(),
    },
    connectors: [
        injected({ target: 'metaMask' }), // MetaMask
        coinbaseWallet({ appName: 'Scratch Game' }), // Coinbase Wallet
        // walletConnect({ projectId }), // WalletConnect (optional - requires project ID)
    ],
})

// USDC on Base Mainnet
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

// Donation amount: $1 USDC (6 decimals)
export const DONATION_AMOUNT = 1_000_000n // $1 USDC

// Smart Contract Address - dari environment variable
export const DONATION_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_GAME_CONTRACT || '0x0000000000000000000000000000000000000000') as `0x${string}`
