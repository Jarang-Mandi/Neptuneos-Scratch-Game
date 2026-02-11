'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAccount, useSignMessage } from 'wagmi'

const TOKEN_KEY = 'scratch-auth-token'
const WALLET_KEY = 'scratch-auth-wallet'

interface AuthState {
    token: string | null
    isAuthenticated: boolean
    isAuthenticating: boolean
    error: string | null
}

/**
 * Hook that manages wallet-based authentication.
 * 
 * Flow:
 * 1. On wallet connect → auto-request nonce from server
 * 2. Prompt user to sign the nonce message
 * 3. Send signature to server → receive session token (24h)
 * 4. Token is stored in sessionStorage and used for all API calls
 * 
 * On wallet disconnect → token is cleared.
 */
export function useAuth() {
    const { address, isConnected } = useAccount()
    const { signMessageAsync } = useSignMessage()
    const [authState, setAuthState] = useState<AuthState>({
        token: null,
        isAuthenticated: false,
        isAuthenticating: false,
        error: null
    })
    const loginAttempted = useRef(false)
    const isAuthenticatingRef = useRef(false)

    // Restore token from sessionStorage on mount
    useEffect(() => {
        if (isConnected && address) {
            const storedToken = sessionStorage.getItem(TOKEN_KEY)
            const storedWallet = sessionStorage.getItem(WALLET_KEY)

            if (storedToken && storedWallet === address.toLowerCase()) {
                setAuthState({
                    token: storedToken,
                    isAuthenticated: true,
                    isAuthenticating: false,
                    error: null
                })
            }
        }
    }, [isConnected, address])

    // Clear auth when wallet disconnects or changes
    useEffect(() => {
        if (!isConnected || !address) {
            sessionStorage.removeItem(TOKEN_KEY)
            sessionStorage.removeItem(WALLET_KEY)
            loginAttempted.current = false
            setAuthState({
                token: null,
                isAuthenticated: false,
                isAuthenticating: false,
                error: null
            })
        }
    }, [isConnected, address])

    /**
     * Perform the full sign-in flow:
     * 1. Request nonce from server
     * 2. Sign the message with wallet
     * 3. Submit signature → get session token
     */
    const login = useCallback(async () => {
        if (!address || !isConnected) return null
        if (isAuthenticatingRef.current) return null
        if (loginAttempted.current) return null

        loginAttempted.current = true
        isAuthenticatingRef.current = true
        setAuthState(prev => ({ ...prev, isAuthenticating: true, error: null }))

        try {
            // Step 1: Get nonce
            const nonceRes = await fetch(`/api/auth/nonce?wallet=${address}`)
            if (!nonceRes.ok) {
                throw new Error('Failed to get nonce')
            }
            const { message } = await nonceRes.json()

            // Step 2: Sign message with wallet
            const signature = await signMessageAsync({ message })

            // Step 3: Send signature to server
            const loginRes = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: address, signature })
            })

            if (!loginRes.ok) {
                const data = await loginRes.json()
                throw new Error(data.error || 'Login failed')
            }

            const { token } = await loginRes.json()

            // Store token
            sessionStorage.setItem(TOKEN_KEY, token)
            sessionStorage.setItem(WALLET_KEY, address.toLowerCase())

            isAuthenticatingRef.current = false
            setAuthState({
                token,
                isAuthenticated: true,
                isAuthenticating: false,
                error: null
            })

            return token
        } catch (error: any) {
            const errorMsg = error?.message?.includes('User rejected')
                ? 'Signature rejected. Please sign to continue.'
                : error?.message || 'Authentication failed'

            isAuthenticatingRef.current = false
            setAuthState(prev => ({
                ...prev,
                isAuthenticating: false,
                error: errorMsg
            }))
            return null
        }
    }, [address, isConnected, signMessageAsync])

    /**
     * Get auth headers for API calls.
     * Returns empty object if not authenticated.
     */
    const getAuthHeaders = useCallback((): Record<string, string> => {
        if (!authState.token) return {}
        return { 'Authorization': `Bearer ${authState.token}` }
    }, [authState.token])

    /**
     * Make an authenticated fetch call.
     * Automatically includes the auth token in headers.
     */
    const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
        const headers = {
            ...options.headers,
            ...getAuthHeaders()
        }
        return fetch(url, { ...options, headers })
    }, [getAuthHeaders])

    /**
     * Reset login guard so auto-login or manual login can be retried.
     * Call this when the user explicitly wants to retry sign-in.
     */
    const retryLogin = useCallback(() => {
        loginAttempted.current = false
        setAuthState(prev => ({ ...prev, error: null }))
    }, [])

    return {
        token: authState.token,
        isAuthenticated: authState.isAuthenticated,
        isAuthenticating: authState.isAuthenticating,
        authError: authState.error,
        login,
        retryLogin,
        getAuthHeaders,
        authFetch
    }
}
