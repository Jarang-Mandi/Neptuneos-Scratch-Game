import { createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'

const DONATION_CONTRACT = (
    process.env.NEXT_PUBLIC_GAME_CONTRACT || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org')
})

const donationAbi = parseAbi([
    'function isSupporter(address) view returns (bool)',
])

/**
 * Verify supporter status directly from the on-chain smart contract.
 * This is trustless — no reliance on client-provided data.
 * The contract is the single source of truth for donation status.
 */
export async function verifySupporterOnChain(wallet: string): Promise<boolean> {
    if (DONATION_CONTRACT === '0x0000000000000000000000000000000000000000') {
        return false
    }

    try {
        const isSupporter = await publicClient.readContract({
            address: DONATION_CONTRACT,
            abi: donationAbi,
            functionName: 'isSupporter',
            args: [wallet as `0x${string}`]
        })

        return Boolean(isSupporter)
    } catch (error) {
        console.error('On-chain supporter verification failed:', error)
        return false
    }
}
