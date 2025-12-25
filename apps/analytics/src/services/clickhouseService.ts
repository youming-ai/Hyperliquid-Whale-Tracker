import { createClient } from '@clickhouse/client';
import { config } from '../config';
import { logger } from '../utils/logger';

export class ClickHouseService {
  private client: any;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      host: config.clickhouse.url,
      database: config.clickhouse.database,
      username: config.clickhouse.user,
      password: config.clickhouse.password,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.ping();
      this.isConnected = true;
      logger.info('Connected to ClickHouse');
    } catch (error) {
      logger.error('Failed to connect to ClickHouse:', error);
      throw error;
    }
  }

  async getTopTraders(options: any) {
    if (!this.isConnected) await this.connect();

    const { symbol, timeframe, metric, limit, offset } = options;

    let query = `
      SELECT
        trader_id,
        symbol,
        SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) as buy_count,
        SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) as sell_count,
        SUM(price * size) as volume,
        AVG(price) as avg_price,
        COUNT(*) as trade_count
      FROM hyperliquid_trades
      WHERE timestamp >= now() - INTERVAL ${this.getTimeframeInterval(timeframe)}
    `;

    if (symbol) {
      query += ` AND symbol = '${symbol}'`;
    }

    query += `
      GROUP BY trader_id, symbol
      ORDER BY ${this.getMetricColumn(metric)} DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    try {
      const result = await this.client.query({ query });
      return result.json();
    } catch (error) {
      logger.error('Error fetching top traders:', error);
      throw error;
    }
  }

  async getTraderTradingStats(traderId: string, timeframe: string) {
    if (!this.isConnected) await this.connect();

    const query = `
      SELECT
        symbol,
        COUNT(*) as trade_count,
        SUM(price * size) as volume,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) as buy_count,
        SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) as sell_count,
        MIN(timestamp) as first_trade,
        MAX(timestamp) as last_trade
      FROM hyperliquid_trades
      WHERE trader_id = '${traderId}'
        AND timestamp >= now() - INTERVAL ${this.getTimeframeInterval(timeframe)}
      GROUP BY symbol
      ORDER BY volume DESC
    `;

    try {
      const result = await this.client.query({ query });
      return result.json();
    } catch (error) {
      logger.error('Error fetching trader trading stats:', error);
      throw error;
    }
  }

  async getMarketStats(options: any) {
    if (!this.isConnected) await this.connect();

    const { symbol, timeframe } = options;

    let query = `
      SELECT
        COUNT(*) as total_trades,
        SUM(price * size) as total_volume,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        COUNT(DISTINCT trader_id) as unique_traders
      FROM hyperliquid_trades
      WHERE timestamp >= now() - INTERVAL ${this.getTimeframeInterval(timeframe)}
    `;

    if (symbol) {
      query += ` AND symbol = '${symbol}'`;
    }

    try {
      const result = await this.client.query({ query });
      return result.json();
    } catch (error) {
      logger.error('Error fetching market stats:', error);
      throw error;
    }
  }

  async getLeaderboard(options: any) {
    if (!this.isConnected) await this.connect();

    const { category, timeframe, limit, symbol } = options;

    let query = `
      SELECT
        trader_id,
        ${this.getCategorySelect(category)},
        COUNT(*) as trade_count
      FROM hyperliquid_trades
      WHERE timestamp >= now() - INTERVAL ${this.getTimeframeInterval(timeframe)}
    `;

    if (symbol) {
      query += ` AND symbol = '${symbol}'`;
    }

    query += `
      GROUP BY trader_id
      ORDER BY ${this.getCategoryOrder(category)} DESC
      LIMIT ${limit}
    `;

    try {
      const result = await this.client.query({ query });
      return result.json();
    } catch (error) {
      logger.error('Error fetching leaderboard:', error);
      throw error;
    }
  }

  async getOHLCVData(options: any) {
    if (!this.isConnected) await this.connect();

    const { symbol, timeframe, limit, startTime, endTime } = options;

    let query = `
      SELECT
        toStartOfInterval(timestamp, INTERVAL ${this.getOHLCVInterval(timeframe)}) as time,
        argMin(price, timestamp) as open,
        max(price) as high,
        min(price) as low,
        argMax(price, timestamp) as close,
        sum(price * size) as volume,
        count(*) as count
      FROM hyperliquid_trades
      WHERE symbol = '${symbol}'
    `;

    if (startTime) {
      query += ` AND timestamp >= '${startTime.toISOString()}'`;
    }
    if (endTime) {
      query += ` AND timestamp <= '${endTime.toISOString()}'`;
    }

    query += `
      GROUP BY time
      ORDER BY time DESC
      LIMIT ${limit}
    `;

    try {
      const result = await this.client.query({ query });
      return result.json();
    } catch (error) {
      logger.error('Error fetching OHLCV data:', error);
      throw error;
    }
  }

  async getHeatmapData(options: any) {
    if (!this.isConnected) await this.connect();

    const { symbol, window, bins, startTime, endTime } = options;

    // This is a simplified heatmap query
    const query = `
      SELECT
        floor(price * ${bins} / (max(price) - min(price))) as price_bin,
        floor((timestamp - min(timestamp)) / (${this.getWindowInterval(window)} / ${bins})) as time_bin,
        sum(price * size) as volume
      FROM hyperliquid_trades
      WHERE symbol = '${symbol}'
        AND timestamp >= now() - INTERVAL ${this.getWindowInterval(window)}
    `;

    if (startTime) {
      query += ` AND timestamp >= '${startTime.toISOString()}'`;
    }
    if (endTime) {
      query += ` AND timestamp <= '${endTime.toISOString()}'`;
    }

    query += ` GROUP BY price_bin, time_bin ORDER BY price_bin, time_bin`;

    try {
      const result = await this.client.query({ query });
      return result.json();
    } catch (error) {
      logger.error('Error fetching heatmap data:', error);
      throw error;
    }
  }

  async getLatestPrice(symbol: string) {
    if (!this.isConnected) await this.connect();

    const query = `
      SELECT price, timestamp
      FROM hyperliquid_trades
      WHERE symbol = '${symbol}'
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    try {
      const result = await this.client.query({ query });
      return result.json()[0];
    } catch (error) {
      logger.error('Error fetching latest price:', error);
      throw error;
    }
  }

  async get24hVolume(symbol: string) {
    if (!this.isConnected) await this.connect();

    const query = `
      SELECT
        sum(price * size) as volume,
        count(*) as trades
      FROM hyperliquid_trades
      WHERE symbol = '${symbol}'
        AND timestamp >= now() - INTERVAL 1 DAY
    `;

    try {
      const result = await this.client.query({ query });
      return result.json()[0];
    } catch (error) {
      logger.error('Error fetching 24h volume:', error);
      throw error;
    }
  }

  async getLatestFundingRate(symbol: string) {
    if (!this.isConnected) await this.connect();

    const query = `
      SELECT fundingRate, fundingTime
      FROM hyperliquid_funding
      WHERE symbol = '${symbol}'
      ORDER BY fundingTime DESC
      LIMIT 1
    `;

    try {
      const result = await this.client.query({ query });
      return result.json()[0];
    } catch (error) {
      logger.error('Error fetching latest funding rate:', error);
      throw error;
    }
  }

  async getLatestOpenInterest(symbol: string) {
    if (!this.isConnected) await this.connect();

    const query = `
      SELECT openInterest, timestamp
      FROM hyperliquid_open_interest
      WHERE symbol = '${symbol}'
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    try {
      const result = await this.client.query({ query });
      return result.json()[0];
    } catch (error) {
      logger.error('Error fetching latest open interest:', error);
      throw error;
    }
  }

  async getPriceHistory(options: any) {
    if (!this.isConnected) await this.connect();

    const { symbol, timeframe, limit, startTime, endTime } = options;

    let query = `
      SELECT
        timestamp,
        price,
        size,
        side
      FROM hyperliquid_trades
      WHERE symbol = '${symbol}'
    `;

    if (startTime) {
      query += ` AND timestamp >= '${startTime.toISOString()}'`;
    }
    if (endTime) {
      query += ` AND timestamp <= '${endTime.toISOString()}'`;
    }

    query += `
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    try {
      const result = await this.client.query({ query });
      return result.json();
    } catch (error) {
      logger.error('Error fetching price history:', error);
      throw error;
    }
  }

  // Advanced analytics methods (simplified implementations)
  async getTradingPatterns(traderId: string, timeframe: string) {
    // Placeholder implementation
    return { patterns: [], timeframe };
  }

  async getRiskMetrics(traderId: string, timeframe: string) {
    // Placeholder implementation
    return { risk: 'low', score: 0.3 };
  }

  async getPerformanceComparison(traderIds: string[], timeframe: string) {
    // Placeholder implementation
    return traderIds.map((id) => ({ traderId: id, performance: Math.random() }));
  }

  async getMarketCorrelations(symbols: string[], timeframe: string) {
    // Placeholder implementation
    return { correlations: [] };
  }

  async getLiquidityAnalysis(symbol: string, timeframe: string) {
    // Placeholder implementation
    return { liquidity: 'high', depth: 1000000 };
  }

  async aggregateTraderMetrics(timeframe: string) {
    // Placeholder implementation
    return { aggregated: true, count: 100 };
  }

  async aggregateMarketMetrics(timeframe: string) {
    // Placeholder implementation
    return { volume: 1000000, trades: 5000 };
  }

  async getVolumeProfile(symbol: string, timeframe: string, bins: number) {
    // Placeholder implementation
    return { profile: [], bins };
  }

  async getPriceImpact(symbol: string, tradeSize: number, timeframe: string) {
    // Placeholder implementation
    return { impact: 0.01, price: 100 };
  }

  async getVolatilityAnalysis(symbol: string, timeframe: string) {
    // Placeholder implementation
    return { volatility: 0.02, trend: 'stable' };
  }

  async getLiquidityDepth(symbol: string, depth: number) {
    // Placeholder implementation
    return { bids: [], asks: [] };
  }

  async getMarketSentiment(symbol?: string) {
    // Placeholder implementation
    return { sentiment: 'neutral', score: 0.5 };
  }

  async getArbitrageOpportunities(symbols: string[]) {
    // Placeholder implementation
    return { opportunities: [] };
  }

  async getMarketRegime(symbol: string, timeframe: string) {
    // Placeholder implementation
    return { regime: 'trending', confidence: 0.7 };
  }

  async getSymbolCorrelations(baseSymbol: string, compareSymbols: string[], timeframe: string) {
    // Placeholder implementation
    return { correlations: [] };
  }

  async getMarketBreadth(symbols: string[]) {
    // Placeholder implementation
    return { breadth: 0.6, advancing: 60, declining: 40 };
  }

  async getTechnicalIndicators(symbol: string, timeframe: string, indicators: string[]) {
    // Placeholder implementation
    return { indicators: {} };
  }

  async getSupportResistanceLevels(symbol: string, timeframe: string, sensitivity: number) {
    // Placeholder implementation
    return { support: [], resistance: [] };
  }

  async getMarketMovers(direction: 'up' | 'down', limit: number, timeframe: string) {
    // Placeholder implementation
    return { movers: [] };
  }

  async getMarketStatistics(timeframe: string) {
    // Placeholder implementation
    return { totalVolume: 10000000, totalTrades: 50000 };
  }

  async getTopVolumeSymbols(limit: number, timeframe: string) {
    // Placeholder implementation
    return { symbols: [] };
  }

  // Helper methods
  private getTimeframeInterval(timeframe: string): string {
    const intervals: { [key: string]: string } = {
      '1h': '1 HOUR',
      '24h': '1 DAY',
      '7d': '7 DAY',
      '30d': '30 DAY',
      '1m': '1 MONTH',
    };
    return intervals[timeframe] || '1 DAY';
  }

  private getMetricColumn(metric: string): string {
    const columns: { [key: string]: string } = {
      pnl: 'SUM(price * size)',
      winrate: 'COUNT(*)',
      volume: 'SUM(price * size)',
      trades: 'COUNT(*)',
    };
    return columns[metric] || 'SUM(price * size)';
  }

  private getCategorySelect(category: string): string {
    const selects: { [key: string]: string } = {
      pnl: 'SUM(price * size) as total_value',
      winrate: 'COUNT(*) as trade_count',
      volume: 'SUM(price * size) as total_volume',
      trades: 'COUNT(*) as trade_count',
    };
    return selects[category] || 'SUM(price * size) as total_value';
  }

  private getCategoryOrder(category: string): string {
    const orders: { [key: string]: string } = {
      pnl: 'total_value',
      winrate: 'trade_count',
      volume: 'total_volume',
      trades: 'trade_count',
    };
    return orders[category] || 'total_value';
  }

  private getOHLCVInterval(timeframe: string): string {
    const intervals: { [key: string]: string } = {
      '1m': '1 MINUTE',
      '5m': '5 MINUTE',
      '15m': '15 MINUTE',
      '1h': '1 HOUR',
      '4h': '4 HOUR',
      '1d': '1 DAY',
    };
    return intervals[timeframe] || '1 HOUR';
  }

  private getWindowInterval(window: string): string {
    const intervals: { [key: string]: string } = {
      '1h': '1 HOUR',
      '4h': '4 HOUR',
      '1d': '1 DAY',
    };
    return intervals[window] || '1 HOUR';
  }
}
