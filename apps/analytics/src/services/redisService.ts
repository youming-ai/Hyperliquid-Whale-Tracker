import { createClient } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export class RedisService {
  private client: any;
  private isConnected = false;

  constructor() {
    this.client = createClient({ url: config.redis.url });

    this.client.on('error', (error: Error) => {
      logger.error('Redis error:', error);
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) await this.connect();

    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Error getting value from Redis:', error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (!this.isConnected) await this.connect();

    try {
      await this.client.set(key, value);
    } catch (error) {
      logger.error('Error setting value in Redis:', error);
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    if (!this.isConnected) await this.connect();

    try {
      await this.client.setEx(key, seconds, value);
    } catch (error) {
      logger.error('Error setting value with expiry in Redis:', error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) await this.connect();

    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Error deleting key from Redis:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) await this.connect();

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Error checking key existence in Redis:', error);
      return false;
    }
  }

  // Real-time data methods
  async getRealTimeActivity(traderId: string): Promise<any> {
    const key = `realtime:activity:${traderId}`;
    const activity = await this.get(key);
    return activity ? JSON.parse(activity) : null;
  }

  async setRealTimeActivity(traderId: string, activity: any): Promise<void> {
    const key = `realtime:activity:${traderId}`;
    await this.setex(key, 300, JSON.stringify(activity)); // 5 minutes TTL
  }

  async getMarketSentiment(symbol?: string): Promise<any> {
    const key = `realtime:sentiment:${symbol || 'global'}`;
    const sentiment = await this.get(key);
    return sentiment ? JSON.parse(sentiment) : { sentiment: 'neutral', score: 0.5 };
  }

  async setMarketSentiment(symbol: string | undefined, sentiment: any): Promise<void> {
    const key = `realtime:sentiment:${symbol || 'global'}`;
    await this.setex(key, 60, JSON.stringify(sentiment)); // 1 minute TTL
  }

  async getRealTimePrice(symbol: string): Promise<number | null> {
    const key = `realtime:price:${symbol}`;
    const price = await this.get(key);
    return price ? parseFloat(price) : null;
  }

  async setRealTimePrice(symbol: string, price: number): Promise<void> {
    const key = `realtime:price:${symbol}`;
    await this.setex(key, 30, price.toString()); // 30 seconds TTL
  }

  async getRealTimeVolume(symbol: string): Promise<number | null> {
    const key = `realtime:volume:${symbol}`;
    const volume = await this.get(key);
    return volume ? parseFloat(volume) : null;
  }

  async setRealTimeVolume(symbol: string, volume: number): Promise<void> {
    const key = `realtime:volume:${symbol}`;
    await this.setex(key, 60, volume.toString()); // 1 minute TTL
  }

  // Cache invalidation methods
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.isConnected) await this.connect();

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error('Error invalidating cache pattern:', error);
    }
  }

  async invalidateSymbolCache(symbol: string): Promise<void> {
    const patterns = [
      `*:${symbol}:*`,
      `ohlcv:${symbol}:*`,
      `market_overview:${symbol}`,
      `heatmap:${symbol}:*`,
      `price_history:${symbol}:*`,
    ];

    for (const pattern of patterns) {
      await this.invalidatePattern(pattern);
    }
  }

  async invalidateTraderCache(traderId: string): Promise<void> {
    const patterns = [
      `trader_profile:${traderId}:*`,
      `top_traders:*traderId*`,
      `realtime:activity:${traderId}`,
    ];

    for (const pattern of patterns) {
      await this.invalidatePattern(pattern);
    }
  }

  // Analytics cache methods
  async getCachedAnalytics(key: string): Promise<any | null> {
    const cached = await this.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setCachedAnalytics(key: string, data: any, ttlSeconds: number = 300): Promise<void> {
    await this.setex(key, ttlSeconds, JSON.stringify(data));
  }

  // Leaderboard caching
  async getLeaderboard(category: string, timeframe: string): Promise<any[] | null> {
    const key = `leaderboard:${category}:${timeframe}`;
    const cached = await this.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setLeaderboard(category: string, timeframe: string, data: any[]): Promise<void> {
    const key = `leaderboard:${category}:${timeframe}`;
    await this.setex(key, 600, JSON.stringify(data)); // 10 minutes TTL
  }

  // Rate limiting (if needed)
  async incrementRateLimit(
    key: string,
    windowSeconds: number,
    limit: number,
  ): Promise<{ count: number; remaining: number; resetTime: number }> {
    if (!this.isConnected) await this.connect();

    try {
      const count = await this.client.incr(key);

      if (count === 1) {
        await this.client.expire(key, windowSeconds);
      }

      const ttl = await this.client.ttl(key);
      const resetTime = Date.now() + ttl * 1000;

      return {
        count,
        remaining: Math.max(0, limit - count),
        resetTime,
      };
    } catch (error) {
      logger.error('Error incrementing rate limit:', error);
      return { count: 0, remaining: limit, resetTime: Date.now() + windowSeconds * 1000 };
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    if (!this.isConnected) await this.connect();

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from Redis');
    }
  }
}
