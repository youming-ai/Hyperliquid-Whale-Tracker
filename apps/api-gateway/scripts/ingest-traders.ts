#!/usr/bin/env bun
/**
 * CLI Script for Trader Data Ingestion
 *
 * Usage:
 *   bun scripts/ingest-traders.ts                    # Ingest known whale addresses
 *   bun scripts/ingest-traders.ts --address=0x...    # Ingest specific address
 *   bun scripts/ingest-traders.ts --concurrency=5    # Set batch size
 */

import { runIngestion } from '../src/jobs/ingest-traders';

// Run ingestion with CLI args
runIngestion(process.argv.slice(2)).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
