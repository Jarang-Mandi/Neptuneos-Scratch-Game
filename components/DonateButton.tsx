'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseAbi } from 'viem'
import { USDC_ADDRESS, DONATION_AMOUNT, DONATION_CONTRACT_ADDRESS } from '@/lib/wagmi'

// ERC20 ABI for approve
const erc20Abi = parseAbi([
    'function approve(address spender, uint256 amount) returns (bool)',
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
    const [step, setStep] = useState<'idle' | 'approving' | 'donating'>('idle')

    const { writeContract, data: hash, isPending, isSuccess, isError } = useWriteContract()

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
            onDonateSuccess?.()
        }
    }, [txSuccess, step])

    // Handle errors
    useEffect(() => {
        if (isError) {
            setStep('idle')
        }
    }, [isError])

    const handleDonate = async () => {
        if (!isConnected) {
            alert('Please connect your wallet first!')
            return
        }

        if (DONATION_CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
            alert('Contract not deployed yet. Please deploy smart contract first.')
            return
        }

        try {
            // Step 1: Approve USDC spending
            setStep('approving')
            writeContract({
                address: USDC_ADDRESS,
                abi: erc20Abi,
                functionName: 'approve',
                args: [DONATION_CONTRACT_ADDRESS, DONATION_AMOUNT],
            })
        } catch (error) {
            console.error('Donation failed:', error)
            setStep('idle')
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
        step === 'approving' ? '⏳ Approving USDC...' :
            step === 'donating' ? '⏳ Processing Donation...' :
                '💰 Donate $1 USDC'

    return (
        <div className="wallet-section">
            <button
                className="donate-btn"
                onClick={handleDonate}
                disabled={!isConnected || isProcessing}
            >
                {buttonText}
            </button>
            <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                Become a Supporter → Get FCFS free NFT mint!
            </p>
        </div>
    )
}
