import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  out: './drizzle/',
  driver: 'pg',
  dbCredentials: {
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://hyperdash:hyperdash_password@localhost:5432/hyperdash',
  },
  strict: true,
} satisfies Config;
