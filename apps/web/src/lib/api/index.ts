import { z } from 'zod';

// =============================================================================
// Type Definitions
// =============================================================================

// Market Types
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
});

export type MarketOverview = z.infer<typeof MarketOverviewSchema>;

export const OHLCVSchema = z.object({
  timestamp: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export type OHLCV = z.infer<typeof OHLCVSchema>;

// Trader Types
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
});

export type TraderProfile = z.infer<typeof TraderProfileSchema>;

export const TraderRankingSchema = z.object({
  address: z.string(),
  pnl7d: z.number(),
  winRate: z.number(),
  trades: z.number(),
  volume: z.number(),
  sharpe: z.number(),
});

export type TraderRanking = z.infer<typeof TraderRankingSchema>;

// Strategy Types
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
});

export type Strategy = z.infer<typeof StrategySchema>;

export const CreateStrategyInput = z.object({
  name: z.string().min(1),
  targetTrader: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  allocationAmount: z.number().min(100),
  leverage: z.number().min(1).max(20),
  maxDailyLoss: z.number().min(1).max(50),
  stopLossPercent: z.number().min(1).max(50),
  takeProfitPercent: z.number().min(1).max(100),
  copyMode: z.enum(['PROPORTIONAL', 'FIXED', 'MIRROR']),
});

export type CreateStrategyInput = z.infer<typeof CreateStrategyInput>;

// =============================================================================
// TODO: Implement API functions using tRPC
// =============================================================================
// The below APIs are now accessed via tRPC hooks (trpc.traders.*)
// This file is kept for type definitions only

export const marketApi = {
  // TODO: Use tRPC market queries
  getOverview: async (_symbol: string): Promise<MarketOverview> => {
    throw new Error('Not implemented - use tRPC instead');
  },
  getOHLCV: async (_symbol: string, _timeframe: string, _limit = 100): Promise<OHLCV[]> => {
    throw new Error('Not implemented - use tRPC instead');
  },
  getHeatmap: async (_symbol: string, _window: string, _binCount = 50) => {
    throw new Error('Not implemented - use tRPC instead');
  },
};

export const tradersApi = {
  // Use tpc.traders.list.useQuery() instead
  getRankings: async (_timeframe: string, _limit = 100): Promise<TraderRanking[]> => {
    throw new Error('Use tRPC instead: trpc.traders.list.useQuery()');
  },
  getProfile: async (_address: string): Promise<TraderProfile> => {
    throw new Error('Use tRPC instead: trpc.traders.byAddress.useQuery({ address })');
  },
  getPositions: async (_address: string) => {
    throw new Error('Use tRPC instead');
  },
  getTrades: async (_address: string, _limit = 100) => {
    throw new Error('Use tRPC instead: trpc.traders.trades.useQuery({ address, limit })');
  },
};

export const strategiesApi = {
  // TODO: Use tRPC copy queries when implemented
  list: async (): Promise<Strategy[]> => {
    throw new Error('Not implemented - use tRPC instead');
  },
  get: async (_id: string): Promise<Strategy> => {
    throw new Error('Not implemented - use tRPC instead');
  },
  create: async (_input: CreateStrategyInput): Promise<Strategy> => {
    throw new Error('Not implemented - use tRPC instead');
  },
  update: async (_id: string, _updates: Partial<CreateStrategyInput>): Promise<Strategy> => {
    throw new Error('Not implemented - use tRPC instead');
  },
  toggle: async (_id: string, _active: boolean): Promise<Strategy> => {
    throw new Error('Not implemented - use tRPC instead');
  },
  delete: async (_id: string): Promise<void> => {
    throw new Error('Not implemented - use tRPC instead');
  },
};

export const authApi = {
  // TODO: Use tRPC auth queries when implemented
  getNonce: async (_walletAddress: string): Promise<{ nonce: string }> => {
    throw new Error('Not implemented - use tRPC instead');
  },
  login: async (
    _walletAddress: string,
    _signature: string,
    _message: string,
  ): Promise<{ token: string; refreshToken: string }> => {
    throw new Error('Not implemented - use tRPC instead');
  },
  refreshToken: async (_refreshToken: string): Promise<{ token: string }> => {
    throw new Error('Not implemented - use tRPC instead');
  },
  logout: async (): Promise<void> => {
    throw new Error('Not implemented - use tRPC instead');
  },
};
