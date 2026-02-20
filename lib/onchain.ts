import { parseAbi } from 'viem'
import { publicClient } from '@/lib/rpc'
import { redis } from '@/lib/redis'

const DONATION_CONTRACT = (
    process.env.NEXT_PUBLIC_GAME_CONTRACT || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

const donationAbi = parseAbi([
    'function isSupporter(address) view returns (bool)',
])

// Cache TTL for on-chain supporter checks (60s).
// Prevents hammering the public RPC under high donation-verification load.
const SUPPORTER_CACHE_TTL = 60

/**
 * Verify supporter status directly from the on-chain smart contract.
 * Result is cached in Redis for 60s to avoid RPC rate-limit issues.
 * The contract is the single source of truth for donation status.
 */
export async function verifySupporterOnChain(wallet: string): Promise<boolean> {
    if (DONATION_CONTRACT === '0x0000000000000000000000000000000000000000') {
        return false
    }

    const walletLower = wallet.toLowerCase()
    const cacheKey = `supporter-check:${walletLower}`

    // Check cache first
    const cached = await redis.get(cacheKey)
    if (cached !== null) {
        return cached === 'true'
    }

    try {
        const isSupporter = await publicClient.readContract({
            address: DONATION_CONTRACT,
            abi: donationAbi,
            functionName: 'isSupporter',
            args: [walletLower as `0x${string}`]
        })

        const result = Boolean(isSupporter)

        // Cache the result
        await redis.set(cacheKey, result ? 'true' : 'false', { ex: SUPPORTER_CACHE_TTL })

        return result
    } catch (error) {
        console.error('On-chain supporter verification failed:', error)
        return false
    }
}
