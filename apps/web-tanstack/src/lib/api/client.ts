// Environment configuration

// Environment configuration
export const env = {
    API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws',
    WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
    ENV: import.meta.env.VITE_ENV || 'development',
    IS_DEV: import.meta.env.DEV,
    IS_PROD: import.meta.env.PROD,
}

// API Response types
export interface ApiResponse<T> {
    success: boolean
    data?: T
    error?: string
}

// Base API client
class ApiClient {
    private baseUrl: string
    private token: string | null = null

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl
    }

    setToken(token: string | null) {
        this.token = token
    }

    private getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        }
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`
        }
        return headers
    }

    async get<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: this.getHeaders(),
        })

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`)
        }

        return response.json()
    }

    async post<T>(endpoint: string, data?: unknown): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: data ? JSON.stringify(data) : undefined,
        })

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`)
        }

        return response.json()
    }
}

export const apiClient = new ApiClient(env.API_URL)
