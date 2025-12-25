import { config } from './config';
import { AnalyticsServer } from './server';
import { logger } from './utils/logger';

async function main() {
  logger.info('Starting Hyperliquid Analytics Service...');

  try {
    const server = new AnalyticsServer();
    await server.start();

    logger.info(`Analytics service started on port ${config.port}`);

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down analytics service...');
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    logger.error('Failed to start analytics service:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
