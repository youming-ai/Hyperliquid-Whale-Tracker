import { z } from 'zod';
import {
  MarketOverviewParamsSchema,
  OHLCVParamsSchema,
  HeatmapParamsSchema,
  schemas
} from '@hyperdash/shared-types';
import { t } from '../trpc';
import { NotFoundError } from '../utils/errors';

export const marketRouter = t.router({
  // Market Overview
  overview: t.procedure
    .input(MarketOverviewParamsSchema)
    .query(async ({ input, ctx }) => {
      // Implementation will query ClickHouse for current market data
      const { symbol } = input;

      // Mock data for now
      return schemas.MarketOverview.parse({
        symbol,
        exchange: 'hyperliquid',
        timestamp: new Date().toISOString(),
        price: 42000.50,
        markPrice: 42001.25,
        indexPrice: 41999.75,
        fundingRate: 0.0001,
        nextFundingTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        openInterest: 125000000,
        volume24h: 2500000000,
        longShortRatio: 0.65,
        volatility24h: 0.045,
      });
    }),

  // OHLCV Data
  ohlcv: t.procedure
    .input(OHLCVParamsSchema)
    .query(async ({ input, ctx }) => {
      const { symbol, timeframe, limit } = input;

      // Implementation will query ClickHouse for historical data
      // Mock data for now
      const data = Array.from({ length: limit }, (_, i) => ({
        timestamp: new Date(Date.now() - (limit - i) * 60 * 60 * 1000).toISOString(),
        open: 42000 + Math.random() * 100,
        high: 42100 + Math.random() * 100,
        low: 41900 + Math.random() * 100,
        close: 42000 + Math.random() * 100,
        volume: 1000000 + Math.random() * 500000,
        tradeCount: Math.floor(100 + Math.random() * 400),
      }));

      return data.map(item => schemas.OHLCV.parse(item));
    }),

  // Liquidation Heatmap
  heatmap: t.procedure
    .input(HeatmapParamsSchema)
    .query(async ({ input, ctx }) => {
      const { symbol, window, binCount } = input;

      // Implementation will query ClickHouse heatmap bins
      // Mock data for now
      const data = Array.from({ length: binCount }, (_, i) => {
        const price = 41000 + i * 200;
        return {
          priceBinCenter: price,
          priceBinWidth: 200,
          liquidationVolume: Math.random() * 1000000,
          liquidationCount: Math.floor(Math.random() * 100),
          liquidationNotional: Math.random() * 1000000 * price,
          confidenceScore: 0.7 + Math.random() * 0.3,
        };
      });

      return data.map(item => schemas.HeatmapBin.parse(item));
    }),
});
