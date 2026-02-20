import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

/**
 * Single shared publicClient for ALL on-chain reads:
 *   - Auth signature verification (EIP-1271 smart wallets / passkeys)
 *   - Supporter status verification (readContract)
 *
 * Consolidates two separate instances (lib/auth.ts + lib/onchain.ts)
 * into one client with:
 *   - Private RPC URL support via BASE_RPC_URL env var
 *   - 5s timeout to prevent stalling serverless functions
 *   - 2 retries with 500ms delay for transient RPC failures
 */
export const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || undefined, {
        timeout: 5_000,
        retryCount: 2,
        retryDelay: 500,
    }),
})
