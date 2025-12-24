import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { z } from 'zod';

// Schemas
const MarketOverviewSchema = z.object({
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

const OHLCVSchema = z.object({
  timestamp: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export type MarketOverview = z.infer<typeof MarketOverviewSchema>;
export type OHLCV = z.infer<typeof OHLCVSchema>;

interface UseMarketDataOptions {
  symbol: string;
  timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  enableWebSocket?: boolean;
  refetchInterval?: number;
}

// Mock API functions (replace with real API calls)
async function fetchMarketOverview(symbol: string): Promise<MarketOverview> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  return {
    symbol,
    price: 42350 + Math.random() * 200 - 100,
    markPrice: 42355,
    indexPrice: 42348,
    fundingRate: 0.0012,
    nextFundingTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    openInterest: 850000000,
    volume24h: 1250000000,
    change24h: 2.45 + Math.random() * 0.5 - 0.25,
    longShortRatio: 1.15,
    volatility24h: 3.2,
  };
}

async function fetchOHLCV(_symbol: string, timeframe: string, limit = 100): Promise<OHLCV[]> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const now = Date.now();
  const intervalMs =
    {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    }[timeframe] || 60 * 60 * 1000;

  let basePrice = 42000;

  return Array.from({ length: limit }, (_, i) => {
    const volatility = Math.random() * 200 - 100;
    basePrice += volatility;
    const open = basePrice;
    const high = open + Math.random() * 100;
    const low = open - Math.random() * 100;
    const close = low + Math.random() * (high - low);

    return {
      timestamp: new Date(now - (limit - i) * intervalMs).toISOString(),
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000000,
    };
  });
}

export function useMarketData(options: UseMarketDataOptions) {
  const { symbol, timeframe = '1h', enableWebSocket = true, refetchInterval = 30000 } = options;

  const queryClient = useQueryClient();

  // Fetch market overview
  const overviewQuery = useQuery({
    queryKey: ['market', 'overview', symbol],
    queryFn: () => fetchMarketOverview(symbol),
    refetchInterval: enableWebSocket ? false : refetchInterval,
    staleTime: 10000,
  });

  // Fetch OHLCV data
  const ohlcvQuery = useQuery({
    queryKey: ['market', 'ohlcv', symbol, timeframe],
    queryFn: () => fetchOHLCV(symbol, timeframe),
    staleTime: 60000, // Less frequent updates for chart data
  });

  // WebSocket updates
  const updateMarketData = useCallback(
    (data: Partial<MarketOverview>) => {
      queryClient.setQueryData(
        ['market', 'overview', symbol],
        (old: MarketOverview | undefined) => {
          if (!old) return old;
          return { ...old, ...data };
        },
      );
    },
    [queryClient, symbol],
  );

  // WebSocket connection (mock for now)
  useEffect(() => {
    if (!enableWebSocket) return;

    // In production, connect to real WebSocket
    const interval = setInterval(() => {
      // Simulate real-time price updates
      updateMarketData({
        price: 42350 + Math.random() * 200 - 100,
        change24h: 2.45 + Math.random() * 0.5 - 0.25,
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [enableWebSocket, updateMarketData]);

  // Refetch function
  const refetch = useCallback(() => {
    overviewQuery.refetch();
    ohlcvQuery.refetch();
  }, [overviewQuery, ohlcvQuery]);

  return {
    overview: overviewQuery.data,
    ohlcv: ohlcvQuery.data,
    isLoading: overviewQuery.isLoading || ohlcvQuery.isLoading,
    isError: overviewQuery.isError || ohlcvQuery.isError,
    error: overviewQuery.error || ohlcvQuery.error,
    refetch,
    lastUpdated: overviewQuery.dataUpdatedAt ? new Date(overviewQuery.dataUpdatedAt) : null,
  };
}
