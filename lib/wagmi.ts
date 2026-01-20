import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'

export const config = createConfig({
    chains: [base],
    transports: {
        [base.id]: http(),
    },
    connectors: [
        miniAppConnector()
    ]
})

// USDC contract on Base
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

// Game contract address (will be deployed)
export const GAME_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000' as const

// Donation amount in USDC (6 decimals)
export const DONATION_AMOUNT = 1_000_000n // $1 USDC
