import { config } from '../config';
import { logger } from '../utils/logger';
import { ClickHouseService } from './clickhouseService';
import { RedisService } from './redisService';

interface OHLCVOptions {
  symbol: string;
  timeframe: string;
  limit: number;
  startTime?: Date;
  endTime?: Date;
}

interface HeatmapOptions {
  symbol: string;
  window: string;
  bins: number;
  startTime?: Date;
  endTime?: Date;
}

interface PriceHistoryOptions {
  symbol: string;
  timeframe: string;
  limit: number;
  startTime?: Date;
  endTime?: Date;
}

export class MarketAnalyticsService {
  private clickhouseService: ClickHouseService;
  private redisService: RedisService;

  constructor() {
    this.clickhouseService = new ClickHouseService();
    this.redisService = new RedisService();
  }

  async getOHLCVData(options: OHLCVOptions) {
    const cacheKey = `ohlcv:${options.symbol}:${options.timeframe}:${options.limit}:${options.startTime?.getTime()}:${options.endTime?.getTime()}`;

    // Try to get from cache first for recent data
    if (!options.startTime && !options.endTime) {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Fetch from ClickHouse
    const ohlcvData = await this.clickhouseService.getOHLCVData(options);

    // Cache only recent data (no custom time ranges)
    if (!options.startTime && !options.endTime) {
      await this.redisService.setex(cacheKey, config.cache.marketData, JSON.stringify(ohlcvData));
    }

    return ohlcvData;
  }

  async getHeatmapData(options: HeatmapOptions) {
    const cacheKey = `heatmap:${options.symbol}:${options.window}:${options.bins}:${options.startTime?.getTime()}:${options.endTime?.getTime()}`;

    // Try to get from cache first for recent data
    if (!options.startTime && !options.endTime) {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Fetch from ClickHouse
    const heatmapData = await this.clickhouseService.getHeatmapData(options);

    // Cache only recent data (no custom time ranges)
    if (!options.startTime && !options.endTime) {
      await this.redisService.setex(cacheKey, config.cache.analytics, JSON.stringify(heatmapData));
    }

    return heatmapData;
  }

  async getMarketOverview(symbol: string) {
    const cacheKey = `market_overview:${symbol}`;

    // Try to get from cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch comprehensive market overview
    const [priceData, volumeData, fundingData, openInterest] = await Promise.all([
      this.clickhouseService.getLatestPrice(symbol),
      this.clickhouseService.get24hVolume(symbol),
      this.clickhouseService.getLatestFundingRate(symbol),
      this.clickhouseService.getLatestOpenInterest(symbol),
    ]);

    const overview = {
      symbol,
      price: priceData,
      volume: volumeData,
      funding: fundingData,
      openInterest: openInterest,
      timestamp: new Date().toISOString(),
    };

    // Cache the result
    await this.redisService.setex(cacheKey, config.cache.marketData, JSON.stringify(overview));

    return overview;
  }

  async getPriceHistory(options: PriceHistoryOptions) {
    const cacheKey = `price_history:${options.symbol}:${options.timeframe}:${options.limit}:${options.startTime?.getTime()}:${options.endTime?.getTime()}`;

    // Try to get from cache first for recent data
    if (!options.startTime && !options.endTime) {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Fetch from ClickHouse
    const priceHistory = await this.clickhouseService.getPriceHistory(options);

    // Cache only recent data (no custom time ranges)
    if (!options.startTime && !options.endTime) {
      await this.redisService.setex(
        cacheKey,
        config.cache.marketData,
        JSON.stringify(priceHistory),
      );
    }

    return priceHistory;
  }

  // Advanced market analytics
  async getVolumeProfile(symbol: string, timeframe: string, bins: number = 50) {
    const volumeProfile = await this.clickhouseService.getVolumeProfile(symbol, timeframe, bins);
    return volumeProfile;
  }

  async getPriceImpact(symbol: string, tradeSize: number, timeframe: string) {
    const impact = await this.clickhouseService.getPriceImpact(symbol, tradeSize, timeframe);
    return impact;
  }

  async getVolatilityAnalysis(symbol: string, timeframe: string) {
    const volatility = await this.clickhouseService.getVolatilityAnalysis(symbol, timeframe);
    return volatility;
  }

  async getLiquidityDepth(symbol: string, depth: number = 20) {
    const liquidityDepth = await this.clickhouseService.getLiquidityDepth(symbol, depth);
    return liquidityDepth;
  }

  async getMarketSentiment(symbol?: string) {
    const sentiment = await this.clickhouseService.getMarketSentiment(symbol);
    return sentiment;
  }

  async getArbitrageOpportunities(symbols: string[]) {
    const opportunities = await this.clickhouseService.getArbitrageOpportunities(symbols);
    return opportunities;
  }

  async getMarketRegime(symbol: string, timeframe: string) {
    const regime = await this.clickhouseService.getMarketRegime(symbol, timeframe);
    return regime;
  }

  // Correlation analysis
  async getSymbolCorrelations(baseSymbol: string, compareSymbols: string[], timeframe: string) {
    const correlations = await this.clickhouseService.getSymbolCorrelations(
      baseSymbol,
      compareSymbols,
      timeframe,
    );
    return correlations;
  }

  async getMarketBreadth(symbols: string[]) {
    const breadth = await this.clickhouseService.getMarketBreadth(symbols);
    return breadth;
  }

  // Technical indicators
  async getTechnicalIndicators(symbol: string, timeframe: string, indicators: string[]) {
    const technicalData = await this.clickhouseService.getTechnicalIndicators(
      symbol,
      timeframe,
      indicators,
    );
    return technicalData;
  }

  async getSupportResistanceLevels(symbol: string, timeframe: string, sensitivity: number = 0.02) {
    const levels = await this.clickhouseService.getSupportResistanceLevels(
      symbol,
      timeframe,
      sensitivity,
    );
    return levels;
  }

  // Batch operations
  async batchGetMarketOverview(symbols: string[]) {
    const overviews = await Promise.all(symbols.map((symbol) => this.getMarketOverview(symbol)));
    return overviews;
  }

  async batchGetOHLCVData(symbols: string[], timeframe: string, limit: number) {
    const ohlcvData = await Promise.all(
      symbols.map((symbol) =>
        this.getOHLCVData({ symbol, timeframe, limit, startTime: undefined, endTime: undefined }),
      ),
    );
    return ohlcvData;
  }

  // Real-time market data
  async getRealTimePrice(symbol: string) {
    const price = await this.redisService.getRealTimePrice(symbol);
    return price;
  }

  async getRealTimeVolume(symbol: string) {
    const volume = await this.redisService.getRealTimeVolume(symbol);
    return volume;
  }

  async getMarketMovers(direction: 'up' | 'down', limit: number = 10, timeframe: string = '24h') {
    const movers = await this.clickhouseService.getMarketMovers(direction, limit, timeframe);
    return movers;
  }

  // Market statistics
  async getMarketStatistics(timeframe: string) {
    const stats = await this.clickhouseService.getMarketStatistics(timeframe);
    return stats;
  }

  async getTopVolumeSymbols(limit: number = 20, timeframe: string = '24h') {
    const symbols = await this.clickhouseService.getTopVolumeSymbols(limit, timeframe);
    return symbols;
  }
}
