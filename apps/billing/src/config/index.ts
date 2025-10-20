import { z } from 'zod';

const envSchema = z.object({
  // Service configuration
  PORT: z.string().default('3005'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // PostgreSQL configuration
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.string().default('5432'),
  POSTGRES_DATABASE: z.string().default('hyperdash'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default('postgres'),

  // Redis configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Stripe configuration
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // API configuration
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGINS: z.string().default('http://localhost:3001,http://localhost:3000'),

  // Billing settings
  BILLING_CYCLE_DAYS: z.string().default('30'),
  GRACE_PERIOD_DAYS: z.string().default('7'),
  MAX_RETRY_ATTEMPTS: z.string().default('3'),

  // Email configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  FROM_EMAIL: z.string().default('billing@hyperdash.io'),
});

const env = envSchema.parse(process.env);

export const config = {
  port: parseInt(env.PORT),
  nodeEnv: env.NODE_ENV,
  apiPrefix: env.API_PREFIX,
  corsOrigins: env.CORS_ORIGINS.split(','),

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

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  },

  billing: {
    cycleDays: parseInt(env.BILLING_CYCLE_DAYS),
    gracePeriodDays: parseInt(env.GRACE_PERIOD_DAYS),
    maxRetryAttempts: parseInt(env.MAX_RETRY_ATTEMPTS),
  },

  email: {
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT),
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.FROM_EMAIL,
  },

  // Subscription plans
  plans: {
    freemium: {
      name: 'Freemium',
      price: 0,
      features: ['Basic market data', 'Limited API calls', 'Community support'],
      apiCallsPerMonth: 1000,
      maxCopies: 0,
    },
    premium: {
      name: 'Premium',
      price: 29.99,
      features: ['Real-time market data', 'Advanced analytics', 'Copy trading (3 traders)', 'Email support'],
      apiCallsPerMonth: 10000,
      maxCopies: 3,
    },
    enterprise: {
      name: 'Enterprise',
      price: 99.99,
      features: ['Real-time market data', 'Advanced analytics', 'Copy trading (unlimited)', 'Priority support', 'Custom features'],
      apiCallsPerMonth: 100000,
      maxCopies: -1, // unlimited
    },
  },
} as const;

export type Config = typeof config;
