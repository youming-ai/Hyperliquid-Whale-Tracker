import { apiClient } from './client'
import { z } from 'zod'

// =============================================================================
// Market API
// =============================================================================

export const MarketOverviewSchema = z.object({
    symbol: z.string(),
    price: z.number(),
    markPrice: z.number(),
    indexPrice: z.number(),
    fundingRate: z.number(),
    nextFundingTime: z.string(),
    openInterest: z.number(),
    volume24h: z.number(),
    change24h: z.number(),
    longShortRatio: z.number(),
    volatility24h: z.number(),
})

export type MarketOverview = z.infer<typeof MarketOverviewSchema>

export const OHLCVSchema = z.object({
    timestamp: z.string(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
})

export type OHLCV = z.infer<typeof OHLCVSchema>

export const marketApi = {
    getOverview: async (symbol: string): Promise<MarketOverview> => {
        const response = await apiClient.post<{ result: { data: MarketOverview } }>(
            '/api/trpc/market.marketOverview',
            { symbol }
        )
        return response.result.data
    },

    getOHLCV: async (symbol: string, timeframe: string, limit = 100): Promise<OHLCV[]> => {
        const response = await apiClient.post<{ result: { data: OHLCV[] } }>(
            '/api/trpc/market.ohlcv',
            { symbol, timeframe, limit }
        )
        return response.result.data
    },

    getHeatmap: async (symbol: string, window: string, binCount = 50) => {
        const response = await apiClient.post<{ result: { data: unknown[] } }>(
            '/api/trpc/market.heatmap',
            { symbol, window, binCount }
        )
        return response.result.data
    },
}

// =============================================================================
// Traders API
// =============================================================================

export const TraderProfileSchema = z.object({
    address: z.string(),
    pnl24h: z.number(),
    pnl7d: z.number(),
    pnl30d: z.number(),
    winRate: z.number(),
    totalTrades: z.number(),
    avgHoldingTime: z.string(),
    maxDrawdown: z.number(),
    sharpeRatio: z.number(),
})

export type TraderProfile = z.infer<typeof TraderProfileSchema>

export const TraderRankingSchema = z.object({
    address: z.string(),
    pnl7d: z.number(),
    winRate: z.number(),
    trades: z.number(),
    volume: z.number(),
    sharpe: z.number(),
})

export type TraderRanking = z.infer<typeof TraderRankingSchema>

export const tradersApi = {
    getRankings: async (timeframe: string, limit = 100): Promise<TraderRanking[]> => {
        const response = await apiClient.post<{ result: { data: TraderRanking[] } }>(
            '/api/trpc/traders.rankings',
            { timeframe, limit }
        )
        return response.result.data
    },

    getProfile: async (address: string): Promise<TraderProfile> => {
        const response = await apiClient.post<{ result: { data: TraderProfile } }>(
            '/api/trpc/traders.profile',
            { address }
        )
        return response.result.data
    },

    getPositions: async (address: string) => {
        const response = await apiClient.post<{ result: { data: unknown[] } }>(
            '/api/trpc/traders.positions',
            { address }
        )
        return response.result.data
    },

    getTrades: async (address: string, limit = 100) => {
        const response = await apiClient.post<{ result: { data: unknown[] } }>(
            '/api/trpc/traders.trades',
            { address, limit }
        )
        return response.result.data
    },
}

// =============================================================================
// Strategies API (Copy Trading)
// =============================================================================

export const StrategySchema = z.object({
    id: z.string(),
    name: z.string(),
    targetAddress: z.string(),
    status: z.enum(['ACTIVE', 'PAUSED', 'STOPPED', 'ERROR']),
    allocation: z.number(),
    pnl: z.number(),
    createdAt: z.string(),
    settings: z.object({
        copyMode: z.enum(['PROPORTIONAL', 'FIXED', 'MIRROR']),
        leverage: z.number(),
        maxDailyLoss: z.number(),
        stopLossPercent: z.number(),
        takeProfitPercent: z.number(),
    }),
})

export type Strategy = z.infer<typeof StrategySchema>

export const CreateStrategyInput = z.object({
    name: z.string().min(1),
    targetTrader: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    allocationAmount: z.number().min(100),
    leverage: z.number().min(1).max(20),
    maxDailyLoss: z.number().min(1).max(50),
    stopLossPercent: z.number().min(1).max(50),
    takeProfitPercent: z.number().min(1).max(100),
    copyMode: z.enum(['PROPORTIONAL', 'FIXED', 'MIRROR']),
})

export type CreateStrategyInput = z.infer<typeof CreateStrategyInput>

export const strategiesApi = {
    list: async (): Promise<Strategy[]> => {
        const response = await apiClient.post<{ result: { data: Strategy[] } }>(
            '/api/trpc/copy.listStrategies',
            {}
        )
        return response.result.data
    },

    get: async (id: string): Promise<Strategy> => {
        const response = await apiClient.post<{ result: { data: Strategy } }>(
            '/api/trpc/copy.getStrategy',
            { id }
        )
        return response.result.data
    },

    create: async (input: CreateStrategyInput): Promise<Strategy> => {
        const response = await apiClient.post<{ result: { data: Strategy } }>(
            '/api/trpc/copy.createStrategy',
            input
        )
        return response.result.data
    },

    update: async (id: string, updates: Partial<CreateStrategyInput>): Promise<Strategy> => {
        const response = await apiClient.post<{ result: { data: Strategy } }>(
            '/api/trpc/copy.updateStrategy',
            { id, ...updates }
        )
        return response.result.data
    },

    toggle: async (id: string, active: boolean): Promise<Strategy> => {
        const response = await apiClient.post<{ result: { data: Strategy } }>(
            '/api/trpc/copy.toggleStrategy',
            { id, active }
        )
        return response.result.data
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.post('/api/trpc/copy.deleteStrategy', { id })
    },
}

// =============================================================================
// Auth API
// =============================================================================

export const authApi = {
    getNonce: async (walletAddress: string): Promise<{ nonce: string }> => {
        const response = await apiClient.post<{ result: { data: { nonce: string } } }>(
            '/api/trpc/auth.getNonce',
            { walletAddress }
        )
        return response.result.data
    },

    login: async (walletAddress: string, signature: string, message: string): Promise<{ token: string; refreshToken: string }> => {
        const response = await apiClient.post<{ result: { data: { token: string; refreshToken: string } } }>(
            '/api/trpc/auth.walletLogin',
            { walletAddress, signature, message }
        )
        return response.result.data
    },

    refreshToken: async (refreshToken: string): Promise<{ token: string }> => {
        const response = await apiClient.post<{ result: { data: { token: string } } }>(
            '/api/trpc/auth.refreshToken',
            { refreshToken }
        )
        return response.result.data
    },

    logout: async (): Promise<void> => {
        await apiClient.post('/api/trpc/auth.logout', {})
    },
}

// =============================================================================
// Export all APIs
// =============================================================================

export * from './client'
