import { z } from 'zod';

// Market Data Schemas
export const MarketOverviewSchema = z.object({
  symbol: z.string(),
  exchange: z.string(),
  timestamp: z.string(),
  price: z.number(),
  markPrice: z.number(),
  indexPrice: z.number(),
  fundingRate: z.number(),
  nextFundingTime: z.string(),
  openInterest: z.number(),
  volume24h: z.number(),
  longShortRatio: z.number(),
  volatility24h: z.number(),
});

export const OHLCVSchema = z.object({
  timestamp: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  tradeCount: z.number().optional(),
});

export const HeatmapBinSchema = z.object({
  priceBinCenter: z.number(),
  priceBinWidth: z.number(),
  liquidationVolume: z.number(),
  liquidationCount: z.number(),
  liquidationNotional: z.number(),
  confidenceScore: z.number(),
});

// Trader Schemas
export const TraderSchema = z.object({
  id: z.string(),
  alias: z.string(),
  publicScore: z.number(),
  tags: z.array(z.string()),
  performance: z.object({
    pnl: z.number(),
    returnPct: z.number(),
    sharpeRatio: z.number(),
    maxDrawdown: z.number(),
    winRate: z.number(),
    avgHoldTimeHours: z.number(),
  }),
  tradingActivity: z.object({
    tradeCount: z.number(),
    volume: z.number(),
    turnover: z.number(),
    avgTradeSize: z.number(),
  }),
  riskMetrics: z.object({
    avgLeverage: z.number(),
    maxLeverage: z.number(),
    var95: z.number(),
  }),
  symbolPreferences: z.array(
    z.object({
      symbol: z.string(),
      volumePct: z.number(),
      pnl: z.number(),
    }),
  ),
});

// Copy Trading Schemas
export const CopyStrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['paused', 'active', 'error', 'terminated']),
  mode: z.enum(['portfolio', 'single_trader']),
  maxLeverage: z.number(),
  slippageBps: z.number(),
  minOrderUsd: z.number(),
  followNewEntriesOnly: z.boolean(),
  totalPnl: z.number(),
  totalFees: z.number(),
  alignmentRate: z.number(),
});

// Export types
export type MarketOverview = z.infer<typeof MarketOverviewSchema>;
export type OHLCV = z.infer<typeof OHLCVSchema>;
export type HeatmapBin = z.infer<typeof HeatmapBinSchema>;
export type Trader = z.infer<typeof TraderSchema>;
export type CopyStrategy = z.infer<typeof CopyStrategySchema>;
