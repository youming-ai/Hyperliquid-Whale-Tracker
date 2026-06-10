// Main database package exports

// ClickHouse (analytics)
export { createClickHouseConnection } from '../clickhouse/src/connection';
export * from '../clickhouse/src/schema';

// PostgreSQL (transactional)
export { createPostgresConnection, getDatabaseConnection, DatabaseConnection } from '../postgres/src/connection';
export type { DatabaseConfig } from '../postgres/src/connection';
export * from '../postgres/src/schema';
