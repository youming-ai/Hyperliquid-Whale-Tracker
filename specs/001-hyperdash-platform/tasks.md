import { Cache, CacheManager, CacheFactory } from '@hyperdash/database';
import { 
  MarketOverviewSchema,
  OHLCVSchema,
  HeatmapSchema,
  schemas,
} from '@hyperdash/shared-types';

// Cache keys and TTL strategies
const CacheKeys = {
  // Market overview - 5 minutes TTL for real-time data
  marketOverview: (symbol: string) => `market:overview:${symbol}`,
  
  // OHLCV data - 15 minutes for historical data, 1 minute for recent
  ohlcv: (symbol: string, timeframe: string) => `ohlcv:${symbol}:${timeframe}`,
  
  // Heatmap data - 30 minutes for analysis data
  heatmap: (symbol: string, window: string) => `heatmap:${symbol}:${window}`,
  
  // Top traders - 15 minutes for ranking data
  topTraders: (params: string) => `traders:top:${params}`,
  
  // Trader profile - 30 minutes for profile data
  traderProfile: (traderId: string) => `traders:profile:${traderId}`,
};

const CacheTTL = {
  // Real-time market data - short TTL
  marketOverview: 5 * 60, // 5 minutes
  // Historical OHLCV - longer TTL for smaller timeframes
  ohlcv: {
    '1m': 5 * 60,    // 5 minutes
    '5m': 10 * 60,   // 10 minutes  
    '15m': 15 * 60,  // 15 minutes
    '1h': 30 * 60,   // 30 minutes
    '4h': 60 * 60,   // 1 hour
    '1d': 24 * 60 * 60, // 1 day
  },
  // Analysis data - medium TTL
  heatmap: 30 * 60, // 30 minutes
  // Ranking data - medium TTL
  topTraders: 15 * 60, // 15 minutes
  // Profile data - longer TTL
  traderProfile: 30 * 60, // 30 minutes
};

// Cache tags for bulk invalidation
const CacheTags = {
  market: 'market-data',
  ohlcv: 'ohlcv-data',
  heatmap: 'heatmap-data',
  traders: 'traders-data',
  symbols: 'symbols',
};

// Cache configuration
const getCache = (key: string) => {
  // Use medium-lived cache for most market data
  return CacheFactory.getMediumLivedCache();
};

export class MarketCache {
  private cache: CacheManager;

  constructor() {
    this.cache = CacheFactory.getMediumLivedCache();
  }

  // Market overview caching
  async setMarketOverview(symbol: string, data: schemas.MarketOverview): Promise<void> {
    const key = CacheKeys.marketOverview(symbol);
    const ttl = CacheTTL.marketOverview;
    const tags = [CacheTags.market, CacheTags.symbols];
    
    await this.cache.set(key, data, { ttl, tags });
  }

  async getMarketOverview(symbol: string): Promise<CacheResult<schemas.MarketOverview>> {
    const key = CacheKeys.marketOverview(symbol);
    return await this.cache.get<schemas.MarketOverview>(key);
  }

  // OHLCV data caching
  async setOHLCVData(
    symbol: string, 
    timeframe: string, 
    data: schemas.OHLCVData[]
  ): Promise<void> {
    const key = CacheKeys.ohlcv(symbol, timeframe);
    const ttl = CacheTTL.ohlcv[timeframe as keyof typeof CacheTTL.ohlcv] || CacheTTL.ohlcv['1h'];
    const tags = [CacheTags.ohlcv, CacheTags.market, CacheTags.symbols];
    
    await this.cache.set(key, data, { ttl, tags });
  }

  async getOHLCVData(
    symbol: string, 
    timeframe: string
  ): Promise<CacheResult<schemas.OHLCVData[]>> {
    const key = CacheKeys.ohlcv(symbol, timeframe);
    return await this.cache.get<schemas.OHLCVData[]>(key);
  }

  async appendOHLCVData(
    symbol: string, 
    timeframe: string, 
    newData: schemas.OHLCVData
  ): Promise<void> {
    const key = CacheKeys.ohlcv(symbol, timeframe);
    
    // Get current data and append new candle
    const current = await this.cache.get<schemas.OHLCVData[]>(key);
    const updated = current.hit 
      ? [...current.value, newData].slice(-200) // Keep last 200 candles
      : [newData];
    
    const ttl = CacheTTL.ohlcv[timeframe as keyof typeof CacheTTL.ohlcv] || CacheTTL.ohlcv['1h'];
    await this.cache.set(key, updated, { ttl });
  }

  // Heatmap data caching
  async setHeatmapData(
    symbol: string, 
    window: string, 
    data: schemas.HeatmapBin[]
  ): Promise<void> {
    const key = CacheKeys.heatmap(symbol, window);
    const ttl = CacheTTL.heatmap;
    const tags = [CacheTags.heatmap, CacheTags.market, CacheTags.symbols];
    
    await this.cache.set(key, data, { ttl, tags });
  }

  async getHeatmapData(
    symbol: string, 
    window: string
  ): Promise<CacheResult<schemas.HeatmapBin[]>> {
    const key = CacheKeys.heatmap(symbol, window);
    return await this.cache.get<schemas.HeatmapBin[]>(key);
  }

  // Top traders caching
  async setTopTraders(
    params: string, // Symbol, window, metric, limit, filters
    traders: schemas.TraderData[]
  ): Promise<void> {
    const key = CacheKeys.topTraders(params);
    const ttl = CacheTTL.topTraders;
    const tags = [CacheTags.traders];
    
    await this.cache.set(key, traders, { ttl, tags });
  }

  async getTopTraders(params: string): Promise<CacheResult<schemas.TraderData[]>> {
    const key = CacheKeys.topTraders(params);
    return await this.cache.get<schemas.TraderData[]>(key);
  }

  // Trader profile caching
  async setTraderProfile(traderId: string, profile: schemas.TraderProfile): Promise<void> {
    const key = CacheKeys.traderProfile(traderId);
    const ttl = CacheTTL.traderProfile;
    const tags = [CacheTags.traders];
    
    await this.cache.set(key, profile, { ttl, tags });
  }

  async getTraderProfile(traderId: string): Promise<CacheResult<schemas.TraderProfile>> {
    const key = CacheKeys.traderProfile(traderId);
    return await this.cache.get<schemas.TraderProfile>(key);
  }

  // Bulk operations for efficiency
  async setMultipleMarketData(
    data: {
      marketOverviews: Array<{ symbol: string; data: schemas.MarketOverview }>;
      ohlcvData: Array<{ symbol: string; timeframe: string; data: schemas.OHLCVData[] }>;
      heatmapData: Array<{ symbol: string; window: string; data: schemas.HeatmapBin[] }>;
    }
  ): Promise<void> {
    const cache = CacheFactory.getMediumLivedCache();
    
    // Use multi-set operation
    const operations: Array<{
      key: string;
      value: any;
      options?: { ttl?: number; tags?: string[] };
    }> = [];

    // Market overviews
    data.marketOverviews.forEach(({ symbol, data: overviewData }) => {
      operations.push({
        key: CacheKeys.marketOverview(symbol),
        value: overviewData,
        options: {
          ttl: CacheTTL.marketOverview,
          tags: [CacheTags.market, CacheTags.symbols],
        },
      });
    });

    // OHLCV data
    data.ohlcvData.forEach(({ symbol, timeframe, data: ohlcvData }) => {
      const ttl = CacheTTL.ohlcv[timeframe as keyof typeof CacheTTL.ohlcv] || CacheTTL.ohlcv['1h'];
      operations.push({
        key: CacheKeys.ohlcv(symbol, timeframe),
        value: ohlcvData,
        options: {
          ttl,
          tags: [CacheTags.ohlcv, CacheTags.market, CacheTags.symbols],
        },
      });
    });

    // Heatmap data
    data.heatmapData.forEach(({ symbol, window, data: heatmapData }) => {
      operations.push({
        key: CacheKeys.heatmap(symbol, window),
        value: heatmapData,
        options: {
          ttl: CacheTTL.heatmap,
          tags: [CacheTags.heatmap, CacheTags.market, CacheTags.symbols],
        },
      });
    });

    // Execute batch operations
    if (operations.length > 0) {
      // For simplicity, we'll do individual sets
      // In production, consider using Redis mset command
      await Promise.all(
        operations.map(op => 
          cache.set(op.key, op.value, op.options || {})
        )
      );
    }
  }

  // Cache invalidation strategies
  async invalidateSymbolData(symbol: string): Promise<void> {
    const tags = [
      `${CacheTags.symbols}:${symbol}`,
      CacheTags.market,
      CacheTags.ohlcv,
      CacheTags.heatmap,
    ];

    await Promise.all([
      this.cache.invalidateByTag(tags[0]),
      this.cache.invalidateByTag(CacheTags.market),
      this.cache.invalidateByTag(CacheTags.ohlcv),
      this.cache.invalidateByTag(CacheTags.heatmap),
    ]);
  }

  async invalidateMarketData(): Promise<void> {
    await Promise.all([
      this.cache.invalidateByTag(CacheTags.market),
      this.cache.invalidateByTag(CacheTags.symbols),
    ]);
  }

  async invalidateTradersData(): Promise<void> {
    await this.cache.invalidateByTag(CacheTags.traders);
  }

  // Cache statistics and monitoring
  async getCacheStats(): Promise<any> {
    return await this.cache.getStats();
  }

  async clearCache(): Promise<void> {
    await this.cache.flushAll();
  }

  // Pre-warming strategies
  async prewarmMarketData(symbols: string[]): Promise<void> {
    // This would typically fetch and cache commonly requested data
    console.log(`Prewarming market data for symbols: [${symbols.join(', ')}]`);
    
    // Implementation would depend on your specific data access patterns
    // For now, it's a placeholder for the strategy
  }
}

// Singleton instance
const marketCache = new MarketCache();

export { marketCache as MarketCache };

// Convenience functions
export const marketCacheUtils = {
  // Set market data with error handling
  async setMarketDataSafe(symbol: string, data: schemas.MarketOverview): Promise<boolean> {
    try {
      await marketCache.setMarketOverview(symbol, data);
      return true;
    } catch (error) {
      console.error(`Failed to cache market overview for ${symbol}:`, error);
      return false;
    }
  },

  // Get market data with fallback
  async getMarketDataSafe(symbol: string): Promise<schemas.MarketOverview | null> {
    try {
      const result = await marketCache.getMarketOverview(symbol);
      return result.hit ? result.value : null;
    } catch (error) {
      console.error(`Failed to get cached market overview for ${symbol}:`, error);
      return null;
    }
  },

  // Check if data is fresh (within TTL threshold)
  isDataFresh<T>(result: CacheResult<T>, maxAgeSeconds: number): boolean {
    if (!result.hit) return false;
    
    const age = result.ttl;
    return age !== undefined && age >= maxAgeSeconds;
  },
};