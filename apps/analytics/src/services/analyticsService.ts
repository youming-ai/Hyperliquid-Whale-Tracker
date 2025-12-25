import { config } from '../config';
import { logger } from '../utils/logger';
import { ClickHouseService } from './clickhouseService';
import { PostgreSQLService } from './postgreService';
import { RedisService } from './redisService';

interface TopTradersOptions {
  symbol?: string;
  timeframe: string;
  metric: 'pnl' | 'winrate' | 'volume' | 'trades';
  limit: number;
  offset: number;
}

interface TraderProfileOptions {
  traderId: string;
  timeframe: string;
}

interface MarketStatsOptions {
  symbol?: string;
  timeframe: string;
}

interface LeaderboardOptions {
  category: 'pnl' | 'winrate' | 'volume' | 'trades';
  timeframe: string;
  limit: number;
  symbol?: string;
}

export class AnalyticsService {
  private clickhouseService: ClickHouseService;
  private postgresService: PostgreSQLService;
  private redisService: RedisService;

  constructor() {
    this.clickhouseService = new ClickHouseService();
    this.postgresService = new PostgreSQLService();
    this.redisService = new RedisService();
  }

  async getTopTraders(options: TopTradersOptions) {
    const cacheKey = `top_traders:${JSON.stringify(options)}`;

    // Try to get from cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from database
    const traders = await this.clickhouseService.getTopTraders(options);

    // Cache the result
    await this.redisService.setex(cacheKey, config.cache.leaderboards, JSON.stringify(traders));

    return traders;
  }

  async getTraderProfile(options: TraderProfileOptions) {
    const cacheKey = `trader_profile:${options.traderId}:${options.timeframe}`;

    // Try to get from cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from PostgreSQL and ClickHouse
    const [basicProfile, tradingStats] = await Promise.all([
      this.postgresService.getTraderProfile(options.traderId),
      this.clickhouseService.getTraderTradingStats(options.traderId, options.timeframe),
    ]);

    const profile = {
      ...basicProfile,
      tradingStats,
    };

    // Cache the result
    await this.redisService.setex(cacheKey, config.cache.analytics, JSON.stringify(profile));

    return profile;
  }

  async getMarketStats(options: MarketStatsOptions) {
    const cacheKey = `market_stats:${JSON.stringify(options)}`;

    // Try to get from cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from ClickHouse
    const stats = await this.clickhouseService.getMarketStats(options);

    // Cache the result
    await this.redisService.setex(cacheKey, config.cache.marketData, JSON.stringify(stats));

    return stats;
  }

  async getLeaderboard(options: LeaderboardOptions) {
    const cacheKey = `leaderboard:${JSON.stringify(options)}`;

    // Try to get from cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from database
    const leaderboard = await this.clickhouseService.getLeaderboard(options);

    // Cache the result
    await this.redisService.setex(cacheKey, config.cache.leaderboards, JSON.stringify(leaderboard));

    return leaderboard;
  }

  // Advanced analytics methods
  async getTradingPatterns(traderId: string, timeframe: string) {
    const patterns = await this.clickhouseService.getTradingPatterns(traderId, timeframe);
    return patterns;
  }

  async getRiskMetrics(traderId: string, timeframe: string) {
    const metrics = await this.clickhouseService.getRiskMetrics(traderId, timeframe);
    return metrics;
  }

  async getPerformanceComparison(traderIds: string[], timeframe: string) {
    const comparison = await this.clickhouseService.getPerformanceComparison(traderIds, timeframe);
    return comparison;
  }

  async getMarketCorrelations(symbols: string[], timeframe: string) {
    const correlations = await this.clickhouseService.getMarketCorrelations(symbols, timeframe);
    return correlations;
  }

  async getLiquidityAnalysis(symbol: string, timeframe: string) {
    const analysis = await this.clickhouseService.getLiquidityAnalysis(symbol, timeframe);
    return analysis;
  }

  // Real-time analytics
  async getRealTimeTraderActivity(traderId: string) {
    const activity = await this.redisService.getRealTimeActivity(traderId);
    return activity;
  }

  async getRealTimeMarketSentiment(symbol?: string) {
    const sentiment = await this.redisService.getMarketSentiment(symbol);
    return sentiment;
  }

  // Batch operations for performance
  async batchGetTraderProfiles(traderIds: string[], timeframe: string) {
    const profiles = await this.postgresService.batchGetTraderProfiles(traderIds);

    // Enrich with trading stats
    const enrichedProfiles = await Promise.all(
      profiles.map(async (profile) => {
        const tradingStats = await this.clickhouseService.getTraderTradingStats(
          profile.id,
          timeframe,
        );
        return {
          ...profile,
          tradingStats,
        };
      }),
    );

    return enrichedProfiles;
  }

  // Analytics aggregation
  async aggregateTraderMetrics(timeframe: string) {
    const aggregation = await this.clickhouseService.aggregateTraderMetrics(timeframe);
    return aggregation;
  }

  async aggregateMarketMetrics(timeframe: string) {
    const aggregation = await this.clickhouseService.aggregateMarketMetrics(timeframe);
    return aggregation;
  }
}
