import {
  Cache,
  createAuthMiddleware,
  createRateLimitMiddleware,
  ExternalServiceError,
  NotFoundError,
  RateLimits,
  requireAuth,
  t,
} from '@hyperdash/contracts';
import { getClickHouseConnection, getDatabaseConnection } from '@hyperdash/database';
import {
  HeatmapParamsSchema,
  MarketOverviewParamsSchema,
  OHLCVParamsSchema,
  schemas,
} from '@hyperdash/shared-types';
import { z } from 'zod';

// Market Overview API endpoint
export const marketOverview = t.procedure
  .input(MarketOverviewParamsSchema)
  .use(requireAuth)
  .use(createRateLimitMiddleware(RateLimits.user))
  .query(async ({ input, ctx }) => {
    const { symbol } = input;
    const { user } = ctx;

    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Get ClickHouse connection for market data
      const clickhouse = getClickHouseConnection();
      const chClient = clickhouse.getClient();

      // Get current market overview from ClickHouse
      const query = `
        SELECT
          symbol,
          exchange,
          argMax(price, timestamp) as current_price,
          argMax(mark_price, timestamp) as mark_price,
          argMax(index_price, timestamp) as index_price,
          argMax(funding_rate, timestamp) as funding_rate,
          argMax(oi, timestamp) as open_interest,
          argMax(volume, timestamp) as volume_24h,
          argMax(long_short_ratio, timestamp) as long_short_ratio,
          argMax(volatility_24h, timestamp) as volatility_24h,
          now() as timestamp
        FROM market_ticks_raw
        WHERE symbol = ${symbol}
          AND exchange = 'hyperliquid'
          AND timestamp >= now() - INTERVAL 1 DAY
        GROUP BY symbol, exchange
      `;

      const result = await chClient.query({
        query,
        format: 'JSONEachRow',
      });

      const data = result.json[0];

      if (!data) {
        throw new NotFoundError('Market data', symbol);
      }

      // Transform data to match schema
      const marketOverview = schemas.MarketOverview.parse({
        symbol: data.symbol,
        exchange: data.exchange,
        timestamp: new Date().toISOString(),
        price: parseFloat(data.current_price),
        markPrice: parseFloat(data.mark_price),
        indexPrice: parseFloat(data.index_price),
        fundingRate: parseFloat(data.funding_rate),
        nextFundingTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // Next funding in 8 hours
        openInterest: parseFloat(data.open_interest),
        volume24h: parseFloat(data.volume_24h),
        longShortRatio: parseFloat(data.long_short_ratio),
        volatility24h: parseFloat(data.volatility_24h),
      });

      return marketOverview;
    } catch (error) {
      console.error('Error fetching market overview:', error);

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ExternalServiceError('ClickHouse', 'Failed to fetch market overview');
    }
  });

// OHLCV data retrieval API
export const ohlcv = t.procedure
  .input(OHLCVParamsSchema)
  .use(requireAuth)
  .use(createRateLimitMiddleware(RateLimits.user))
  .query(async ({ input, ctx }) => {
    const { symbol, timeframe, limit } = input;
    const { user } = ctx;

    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const clickhouse = getClickHouseConnection();
      const chClient = clickhouse.getClient();

      // Calculate time interval based on timeframe
      const timeIntervals: Record<string, string> = {
        '1m': 'toStartOfMinute(timestamp)',
        '5m': 'toStartOfFiveMinutes(timestamp)',
        '15m': 'toStartOfFifteenMinutes(timestamp)',
        '1h': 'toStartOfHour(timestamp)',
        '4h': 'toStartOfFourHours(timestamp)',
        '1d': 'toStartOfDay(timestamp)',
      };

      const timeInterval = timeIntervals[timeframe] || timeIntervals['1h'];

      const query = `
        SELECT
          ${timeInterval} as timestamp,
          anyState(price) as open,
          maxState(price) as high,
          minState(price) as low,
          anyState(price) as close,
          sumState(volume) as volume,
          countState() as trade_count,
          avgState(price * volume) / avgState(volume) as vwap,
          (anyState(price) - first_value(price) OVER (ORDER BY timestamp ROWS BETWEEN 1 PRECEDING AND 1 PRECEDING)) / first_value(price) OVER (ORDER BY timestamp ROWS BETWEEN 1 PRECEDING AND 1 PRECEDING) as price_change,
          ((anyState(price) - first_value(price) OVER (ORDER BY timestamp ROWS BETWEEN 1 PRECEDING AND 1 PRECEDING)) / first_value(price) OVER (ORDER BY timestamp ROWS BETWEEN 1 PRECEDING AND 1 PRECEDING)) * 100 as price_change_pct
        FROM market_ticks_raw
        WHERE symbol = ${symbol}
          AND exchange = 'hyperliquid'
          AND timestamp >= now() - INTERVAL ${limit * getIntervalMinutes(timeframe)} MINUTE
        GROUP BY ${timeInterval}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;

      const result = await chClient.query({
        query,
        format: 'JSONEachRow',
      });

      const data = result.json.reverse(); // Return in chronological order

      const ohlcvData = data.map((item) =>
        schemas.OHLCV.parse({
          timestamp: new Date(item.timestamp).toISOString(),
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: parseFloat(item.volume),
          tradeCount: parseInt(item.trade_count),
        }),
      );

      return ohlcvData;
    } catch (error) {
      console.error('Error fetching OHLCV data:', error);
      throw new ExternalServiceError('ClickHouse', 'Failed to fetch OHLCV data');
    }
  });

// Liquidation heatmap calculation API
export const heatmap = t.procedure
  .input(HeatmapParamsSchema)
  .use(requireAuth)
  .use(createRateLimitMiddleware(RateLimits.user))
  .query(async ({ input, ctx }) => {
    const { symbol, window, binCount } = input;
    const { user } = ctx;

    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const clickhouse = getClickHouseConnection();
      const chClient = clickhouse.getClient();

      // Calculate time window
      const windowIntervals: Record<string, number> = {
        '1h': 1,
        '4h': 4,
        '12h': 12,
        '24h': 24,
      };

      const windowHours = windowIntervals[window] || 4;

      // Get price range for bin calculation
      const priceRangeQuery = `
        SELECT
          min(price) as min_price,
          max(price) as max_price,
          avg(price) as avg_price
        FROM market_ticks_raw
        WHERE symbol = ${symbol}
          AND exchange = 'hyperliquid'
          AND timestamp >= now() - INTERVAL ${windowHours} HOUR
      `;

      const priceRangeResult = await chClient.query({
        query: priceRangeQuery,
        format: 'JSONEachRow',
      });

      const priceRange = priceRangeResult.json[0];
      if (!priceRange || !priceRange.min_price || !priceRange.max_price) {
        throw new NotFoundError('Price range data for heatmap', symbol);
      }

      // Calculate bin width
      const priceRangeWidth = parseFloat(priceRange.max_price) - parseFloat(priceRange.min_price);
      const binWidth = priceRangeWidth / binCount;

      // Get liquidation heatmap data
      const heatmapQuery = `
        SELECT
          floor((price - ${parseFloat(priceRange.min_price)}) / ${binWidth}) * ${binWidth} + ${parseFloat(priceRange.min_price)} + ${binWidth / 2} as price_bin_center,
          ${binWidth} as price_bin_width,
          sum(abs(quantity)) as liquidation_volume,
          count() as liquidation_count,
          sum(abs(quantity * price)) as liquidation_notional,
          -- Calculate confidence score based on data density and time recency
          (count() * (1 - (now() - max(timestamp)) / (${windowHours} * 3600))) / 1000 as confidence_score
        FROM liq_heatmap_bins
        WHERE symbol = ${symbol}
          AND exchange = 'hyperliquid'
          AND window_type = '${window}'
          AND timestamp >= now() - INTERVAL ${windowHours} HOUR
        GROUP BY price_bin_center
        ORDER BY price_bin_center
      `;

      const result = await chClient.query({
        query: heatmapQuery,
        format: 'JSONEachRow',
      });

      const heatmapData = result.json.map((item) =>
        schemas.HeatmapBin.parse({
          priceBinCenter: parseFloat(item.price_bin_center),
          priceBinWidth: parseFloat(item.price_bin_width),
          liquidationVolume: parseFloat(item.liquidation_volume),
          liquidationCount: parseInt(item.liquidation_count),
          liquidationNotional: parseFloat(item.liquidation_notional),
          confidenceScore: Math.min(Math.max(parseFloat(item.confidence_score), 0), 1),
        }),
      );

      return heatmapData;
    } catch (error) {
      console.error('Error fetching heatmap data:', error);

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ExternalServiceError('ClickHouse', 'Failed to fetch heatmap data');
    }
  });

// Helper function to get interval minutes
function getIntervalMinutes(timeframe: string): number {
  const intervals: Record<string, number> = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '4h': 240,
    '1d': 1440,
  };
  return intervals[timeframe] || 60;
}

// Create the market router
export const marketRouter = t.router({
  marketOverview,
  ohlcv,
  heatmap,
});
