// Main database package exports

// ClickHouse (analytics)
export { createClickHouseConnection } from '../clickhouse/src/connection';
export * from '../clickhouse/src/schema';
export type { DatabaseConfig } from '../postgres/src/connection';
// PostgreSQL (transactional)
export {
  createPostgresConnection,
  DatabaseConnection,
  getDatabaseConnection,
} from '../postgres/src/connection';
export * from '../postgres/src/schema';
