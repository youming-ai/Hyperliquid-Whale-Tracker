import { useCallback, useEffect, useState } from 'react'
import { useAccount, useSignMessage, useDisconnect } from 'wagmi'
import { authApi, apiClient } from '../lib/api'

interface AuthState {
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null
    token: string | null
}

const TOKEN_KEY = 'hyperdash_auth_token'
const REFRESH_TOKEN_KEY = 'hyperdash_refresh_token'

export function useAuth() {
    const { address, isConnected } = useAccount()
    const { signMessageAsync } = useSignMessage()
    const { disconnect } = useDisconnect()

    const [state, setState] = useState<AuthState>({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        token: null,
    })

    // Check for existing token on mount
    useEffect(() => {
        const token = localStorage.getItem(TOKEN_KEY)
        if (token) {
            apiClient.setToken(token)
            setState(prev => ({ ...prev, isAuthenticated: true, token }))
        }
    }, [])

    // Login with wallet signature
    const login = useCallback(async () => {
        if (!address) {
            setState(prev => ({ ...prev, error: 'No wallet connected' }))
            return
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }))

        try {
            // 1. Get nonce from server
            const { nonce } = await authApi.getNonce(address)

            // 2. Create message to sign
            const message = `Sign this message to login to HyperDash.\n\nNonce: ${nonce}\nWallet: ${address}\nTimestamp: ${Date.now()}`

            // 3. Sign message with wallet
            const signature = await signMessageAsync({ message })

            // 4. Send signature to server for verification
            const { token, refreshToken } = await authApi.login(address, signature, message)

            // 5. Store tokens
            localStorage.setItem(TOKEN_KEY, token)
            localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
            apiClient.setToken(token)

            setState({
                isAuthenticated: true,
                isLoading: false,
                error: null,
                token,
            })
        } catch (error) {
            console.error('Login error:', error)
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Login failed',
            }))
        }
    }, [address, signMessageAsync])

    // Logout
    const logout = useCallback(async () => {
        try {
            await authApi.logout()
        } catch (error) {
            // Ignore logout errors
        }

        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        apiClient.setToken(null)
        disconnect()

        setState({
            isAuthenticated: false,
            isLoading: false,
            error: null,
            token: null,
        })
    }, [disconnect])

    // Refresh token
    const refreshToken = useCallback(async () => {
        const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
        if (!storedRefreshToken) return

        try {
            const { token } = await authApi.refreshToken(storedRefreshToken)
            localStorage.setItem(TOKEN_KEY, token)
            apiClient.setToken(token)
            setState(prev => ({ ...prev, token }))
        } catch (error) {
            // Refresh failed, logout user
            logout()
        }
    }, [logout])

    // Auto-refresh token periodically
    useEffect(() => {
        if (!state.isAuthenticated) return

        const interval = setInterval(() => {
            refreshToken()
        }, 14 * 60 * 1000) // Refresh every 14 minutes

        return () => clearInterval(interval)
    }, [state.isAuthenticated, refreshToken])

    return {
        ...state,
        address,
        isConnected,
        login,
        logout,
        refreshToken,
    }
}
