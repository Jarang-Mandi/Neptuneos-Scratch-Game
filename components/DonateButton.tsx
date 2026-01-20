'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseAbi } from 'viem'
import { USDC_ADDRESS, DONATION_AMOUNT } from '@/lib/wagmi'

// Simple ERC20 approve + transfer ABI
const erc20Abi = parseAbi([
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
])

// Donation receiver address (will be your wallet)
const DONATION_RECEIVER = '0x0000000000000000000000000000000000000000' as const // TODO: Replace with your wallet

interface DonateButtonProps {
    isSupporter: boolean
    onDonateSuccess?: () => void
}

export default function DonateButton({ isSupporter, onDonateSuccess }: DonateButtonProps) {
    const { isConnected, address } = useAccount()
    const [isDonating, setIsDonating] = useState(false)

    const { writeContract, data: hash, isPending } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    })

    // Handle successful donation
    if (isSuccess && isDonating) {
        setIsDonating(false)
        onDonateSuccess?.()
    }

    const handleDonate = async () => {
        if (!isConnected) {
            alert('Please connect your wallet first!')
            return
        }

        setIsDonating(true)

        try {
            // Transfer USDC directly to receiver
            writeContract({
                address: USDC_ADDRESS,
                abi: erc20Abi,
                functionName: 'transfer',
                args: [DONATION_RECEIVER, DONATION_AMOUNT],
            })
        } catch (error) {
            console.error('Donation failed:', error)
            setIsDonating(false)
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

    return (
        <div className="wallet-section">
            <button
                className="donate-btn"
                onClick={handleDonate}
                disabled={!isConnected || isPending || isConfirming}
            >
                {isPending || isConfirming ? '⏳ Processing...' : '💰 Donate $1 USDC'}
            </button>
            <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                Become a Supporter → Get FCFS free NFT mint!
            </p>
        </div>
    )
}
