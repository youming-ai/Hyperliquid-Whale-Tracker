'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';
import { MarketOverviewSchema, OHLCVSchema, HeatmapBinSchema } from '@hyperdash/shared-types';

interface MarketData {
  overview: z.infer<typeof MarketOverviewSchema>;
  ohlcv: z.infer<typeof OHLCVSchema>[];
  heatmap: z.infer<typeof HeatmapBinSchema>[];
}

interface UseMarketDataOptions {
  symbol: string;
  timeframe?: string;
  window?: string;
  refreshInterval?: number;
  enableWebSocket?: boolean;
}

interface UseMarketDataReturn {
  data: MarketData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useMarketData(options: UseMarketDataOptions): UseMarketDataReturn {
  const {
    symbol,
    timeframe = '1h',
    window = '4h',
    refreshInterval = 30000, // 30 seconds
    enableWebSocket = true
  } = options;

  const [data, setData] = useState<MarketData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMarketData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Fetch market overview
      const overviewResponse = await fetch(`${API_BASE_URL}/api/trpc/market.marketOverview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ symbol }),
      });

      if (!overviewResponse.ok) {
        throw new Error(`Failed to fetch market overview: ${overviewResponse.statusText}`);
      }

      const overviewResult = await overviewResponse.json();
      const overview = MarketOverviewSchema.parse(overviewResult.result.data);

      // Fetch OHLCV data
      const ohlcvResponse = await fetch(`${API_BASE_URL}/api/trpc/market.ohlcv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          symbol,
          timeframe,
          limit: 100
        }),
      });

      if (!ohlcvResponse.ok) {
        throw new Error(`Failed to fetch OHLCV data: ${ohlcvResponse.statusText}`);
      }

      const ohlcvResult = await ohlcvResponse.json();
      const ohlcv = ohlcvResult.result.data.map((item: any) => OHLCVSchema.parse(item));

      // Fetch heatmap data
      const heatmapResponse = await fetch(`${API_BASE_URL}/api/trpc/market.heatmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          symbol,
          window,
          binCount: 50
        }),
      });

      if (!heatmapResponse.ok) {
        throw new Error(`Failed to fetch heatmap data: ${heatmapResponse.statusText}`);
      }

      const heatmapResult = await heatmapResponse.json();
      const heatmap = heatmapResult.result.data.map((item: any) => HeatmapBinSchema.parse(item));

      setData({
        overview,
        ohlcv,
        heatmap,
      });

      setLastUpdated(new Date());
      setIsLoading(false);

    } catch (err) {
      console.error('Error fetching market data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  };

  const refetch = () => {
    fetchMarketData();
  };

  // Initial fetch
  useEffect(() => {
    fetchMarketData();
  }, [symbol, timeframe, window]);

  // Periodic refresh
  useEffect(() => {
    if (!enableWebSocket) {
      const interval = setInterval(fetchMarketData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [symbol, timeframe, window, enableWebSocket, refreshInterval, fetchMarketData]);

  // WebSocket updates (when enabled)
  useEffect(() => {
    if (!enableWebSocket) return;

    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'market_update' && message.data.symbol === symbol) {
          // Update only the overview data with real-time price
          setData(prev => {
            if (!prev) return prev;

            return {
              ...prev,
              overview: {
                ...prev.overview,
                ...message.data,
                timestamp: new Date().toISOString(),
              },
            };
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // This would integrate with your WebSocket hook
    // For now, we'll just use the periodic refresh
    return () => {
      // Cleanup WebSocket listeners
    };
  }, [symbol, enableWebSocket]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    refetch,
  };
}
