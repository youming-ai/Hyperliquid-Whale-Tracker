/**
 * Database Connection Wrapper
 *
 * This module wraps the database connection from the @hyperdash/database package
 * to provide a consistent interface within the API gateway.
 */

import { createPostgresConnection } from '@hyperdash/database';

let dbInstance: ReturnType<typeof createPostgresConnection> | null = null;

export function getDatabaseConnection() {
  if (!dbInstance) {
    dbInstance = createPostgresConnection();
  }
  return dbInstance;
}

export async function initializeDatabase() {
  const conn = getDatabaseConnection();
  await conn.initialize();
  return conn;
}

export async function closeDatabase() {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
