'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId, useReadContract } from 'wagmi'
import { parseAbi, formatUnits } from 'viem'
import { base } from 'wagmi/chains'
import { USDC_ADDRESS, DONATION_AMOUNT, DONATION_CONTRACT_ADDRESS } from '@/lib/wagmi'

// ERC20 ABI for approve and balance
const erc20Abi = parseAbi([
    'function approve(address spender, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
])

// Contract ABI for donate function
const donationAbi = parseAbi([
    'function donate() external',
    'function isSupporter(address) view returns (bool)',
])

interface DonateButtonProps {
    isSupporter: boolean
    onDonateSuccess?: () => void
}

export default function DonateButton({ isSupporter, onDonateSuccess }: DonateButtonProps) {
    const { isConnected, address } = useAccount()
    const chainId = useChainId()
    const { switchChain } = useSwitchChain()
    const [step, setStep] = useState<'idle' | 'switching' | 'approving' | 'donating'>('idle')
    const [error, setError] = useState<string>('')

    // Read USDC balance
    const { data: usdcBalance } = useReadContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address && chainId === base.id }
    })

    // Read current allowance
    const { data: allowance } = useReadContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: address ? [address, DONATION_CONTRACT_ADDRESS] : undefined,
        query: { enabled: !!address && chainId === base.id }
    })

    const { writeContract, data: hash, isPending, isSuccess, isError, error: writeError } = useWriteContract()

    const { isLoading: isConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({
        hash,
    })

    // Handle successful transaction
    useEffect(() => {
        if (txSuccess && step === 'approving') {
            // After approve success, call donate
            setStep('donating')
            writeContract({
                address: DONATION_CONTRACT_ADDRESS,
                abi: donationAbi,
                functionName: 'donate',
            })
        } else if (txSuccess && step === 'donating') {
            // Donation complete
            setStep('idle')
            setError('')
            onDonateSuccess?.()
        }
    }, [txSuccess, step])

    // Handle errors
    useEffect(() => {
        if (isError) {
            setStep('idle')
            if (writeError?.message?.includes('User rejected')) {
                setError('Transaction cancelled by user')
            } else if (writeError?.message?.includes('insufficient')) {
                setError('Insufficient USDC balance')
            } else {
                setError('Transaction failed. Please try again.')
            }
        }
    }, [isError, writeError])

    const handleDonate = async () => {
        setError('')

        if (!isConnected) {
            setError('Please connect your wallet first!')
            return
        }

        if (DONATION_CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
            setError('Contract not deployed yet.')
            return
        }

        // Check USDC balance
        if (usdcBalance !== undefined && usdcBalance < DONATION_AMOUNT) {
            const balance = formatUnits(usdcBalance, 6)
            setError(`Insufficient USDC. You have $${balance}, need $1.00`)
            return
        }

        try {
            // Step 0: Switch to Base chain if not already
            if (chainId !== base.id) {
                setStep('switching')
                await switchChain({ chainId: base.id })
                await new Promise(resolve => setTimeout(resolve, 1000))
            }

            // Check if already approved enough
            if (allowance !== undefined && allowance >= DONATION_AMOUNT) {
                // Already approved, go straight to donate
                setStep('donating')
                writeContract({
                    address: DONATION_CONTRACT_ADDRESS,
                    abi: donationAbi,
                    functionName: 'donate',
                })
            } else {
                // Step 1: Approve USDC spending
                setStep('approving')
                writeContract({
                    address: USDC_ADDRESS,
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [DONATION_CONTRACT_ADDRESS, DONATION_AMOUNT],
                })
            }
        } catch (err) {
            console.error('Donation failed:', err)
            setStep('idle')
            setError('Transaction failed. Please try again.')
        }
    }

    if (isSupporter) {
        return (
            <div className="wallet-section">
                <span className="supporter-badge">⭐ Supporter</span>
                <p style={{ fontSize: '12px', color: '#aaa', marginTop: '5px' }}>
                    Thank you for your support! You&apos;ll get FCFS free NFT mint.
                </p>
            </div>
        )
    }

    const isProcessing = isPending || isConfirming || step !== 'idle'
    const buttonText =
        step === 'switching' ? '🔄 Switching to Base...' :
            step === 'approving' ? '⏳ Approving USDC...' :
                step === 'donating' ? '⏳ Processing...' :
                    '💎 Get Supporter Badge - $1'

    // Show wrong network warning
    const isWrongNetwork = chainId !== base.id

    // Format USDC balance for display
    const balanceDisplay = usdcBalance !== undefined
        ? `$${formatUnits(usdcBalance, 6)}`
        : 'Loading...'

    return (
        <div className="wallet-section">
            {/* Network and balance info */}
            {!isWrongNetwork && (
                <div style={{
                    fontSize: '12px',
                    color: '#58d8ff',
                    marginBottom: '8px',
                }}>
                    💵 USDC Balance: {balanceDisplay}
                </div>
            )}

            {isWrongNetwork && (
                <div style={{
                    fontSize: '12px',
                    color: '#ff6b6b',
                    marginBottom: '8px',
                    padding: '8px',
                    background: 'rgba(255, 107, 107, 0.1)',
                    borderRadius: '6px',
                }}>
                    ⚠️ Switch to Base network for donation
                </div>
            )}

            {/* Error message */}
            {error && (
                <div style={{
                    fontSize: '12px',
                    color: '#ff6b6b',
                    marginBottom: '8px',
                    padding: '8px',
                    background: 'rgba(255, 107, 107, 0.1)',
                    borderRadius: '6px',
                }}>
                    ❌ {error}
                </div>
            )}

            <button
                className="donate-btn"
                onClick={handleDonate}
                disabled={!isConnected || isProcessing}
            >
                {buttonText}
            </button>
            <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                Unlock Supporter perks and FCFS free NFT mint
            </p>
        </div>
    )
}
