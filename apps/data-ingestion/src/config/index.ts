import { z } from 'zod';

const envSchema = z.object({
  // Service configuration
  PORT: z.string().default('3003'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ClickHouse configuration
  CLICKHOUSE_HOST: z.string().default('localhost'),
  CLICKHOUSE_PORT: z.string().default('8123'),
  CLICKHOUSE_DATABASE: z.string().default('hyperdash'),
  CLICKHOUSE_USER: z.string().default('default'),
  CLICKHOUSE_PASSWORD: z.string().default(''),

  // Kafka configuration
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('data-ingestion'),

  // Redis configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Hyperliquid API
  HYPERLIQUID_API_URL: z.string().default('https://api.hyperliquid.xyz/info'),
  HYPERLIQUID_WS_URL: z.string().default('wss://api.hyperliquid.xyz/ws'),

  // Collection settings
  COLLECTION_INTERVAL_MS: z.string().default('1000'),
  BATCH_SIZE: z.string().default('100'),
  BATCH_TIMEOUT_MS: z.string().default('5000'),
});

const env = envSchema.parse(process.env);

export const config = {
  port: parseInt(env.PORT),
  nodeEnv: env.NODE_ENV,

  clickhouse: {
    host: env.CLICKHOUSE_HOST,
    port: parseInt(env.CLICKHOUSE_PORT),
    database: env.CLICKHOUSE_DATABASE,
    user: env.CLICKHOUSE_USER,
    password: env.CLICKHOUSE_PASSWORD,
    url: `http://${env.CLICKHOUSE_HOST}:${env.CLICKHOUSE_PORT}`,
  },

  kafka: {
    brokers: env.KAFKA_BROKERS.split(','),
    clientId: env.KAFKA_CLIENT_ID,
  },

  redis: {
    url: env.REDIS_URL,
  },

  hyperliquid: {
    apiUrl: env.HYPERLIQUID_API_URL,
    wsUrl: env.HYPERLIQUID_WS_URL,
  },

  collection: {
    intervalMs: parseInt(env.COLLECTION_INTERVAL_MS),
    batchSize: parseInt(env.BATCH_SIZE),
    batchTimeoutMs: parseInt(env.BATCH_TIMEOUT_MS),
  },

  // Topics for different data types
  topics: {
    trades: 'hyperliquid.trades',
    funding: 'hyperliquid.funding',
    openInterest: 'hyperliquid.open-interest',
    liquidations: 'hyperliquid.liquidations',
    quotes: 'hyperliquid.quotes',
  },
} as const;

export type Config = typeof config;
