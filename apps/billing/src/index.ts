import { config } from './config';
import { BillingServer } from './server';
import { logger } from './utils/logger';

async function main() {
  logger.info('Starting Hyperliquid Billing Service...');

  try {
    const server = new BillingServer();
    await server.start();

    logger.info(`Billing service started on port ${config.port}`);

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down billing service...');
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    logger.error('Failed to start billing service:', error);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
