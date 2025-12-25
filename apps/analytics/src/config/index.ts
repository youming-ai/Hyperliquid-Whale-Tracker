import { z } from 'zod';

const envSchema = z.object({
  // Service configuration
  PORT: z.string().default('3004'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ClickHouse configuration
  CLICKHOUSE_HOST: z.string().default('localhost'),
  CLICKHOUSE_PORT: z.string().default('8123'),
  CLICKHOUSE_DATABASE: z.string().default('hyperdash'),
  CLICKHOUSE_USER: z.string().default('default'),
  CLICKHOUSE_PASSWORD: z.string().default(''),

  // PostgreSQL configuration
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.string().default('5432'),
  POSTGRES_DATABASE: z.string().default('hyperdash'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default('postgres'),

  // Redis configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // API configuration
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGINS: z.string().default('http://localhost:3001,http://localhost:3000'),
});

const env = envSchema.parse(process.env);

export const config = {
  port: parseInt(env.PORT),
  nodeEnv: env.NODE_ENV,
  apiPrefix: env.API_PREFIX,
  corsOrigins: env.CORS_ORIGINS.split(','),

  clickhouse: {
    host: env.CLICKHOUSE_HOST,
    port: parseInt(env.CLICKHOUSE_PORT),
    database: env.CLICKHOUSE_DATABASE,
    user: env.CLICKHOUSE_USER,
    password: env.CLICKHOUSE_PASSWORD,
    url: `http://${env.CLICKHOUSE_HOST}:${env.CLICKHOUSE_PORT}`,
  },

  postgres: {
    host: env.POSTGRES_HOST,
    port: parseInt(env.POSTGRES_PORT),
    database: env.POSTGRES_DATABASE,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    url: `postgresql://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DATABASE}`,
  },

  redis: {
    url: env.REDIS_URL,
  },

  // Cache TTL settings
  cache: {
    marketData: 5 * 60, // 5 minutes
    analytics: 15 * 60, // 15 minutes
    leaderboards: 10 * 60, // 10 minutes
  },

  // Analytics settings
  analytics: {
    maxDataPoints: 1000,
    defaultTimeframe: '1h',
    supportedTimeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
  },
} as const;

export type Config = typeof config;
