import { config } from './config';
import { ClickHouseWriter } from './services/clickhouse-writer';
import { HyperliquidDataCollector } from './services/hyperliquid-collector';
import { KafkaProducer } from './services/kafka-producer';
import { logger } from './utils/logger';

async function main() {
  logger.info('Starting Hyperliquid Data Ingestion Service...');

  try {
    // Initialize services
    const kafkaProducer = new KafkaProducer();
    const clickhouseWriter = new ClickHouseWriter();
    const hyperliquidCollector = new HyperliquidDataCollector({
      kafkaProducer,
      clickhouseWriter,
    });

    // Start data collection
    await hyperliquidCollector.start();

    logger.info('Data ingestion service started successfully');

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down data ingestion service...');
      await hyperliquidCollector.stop();
      await kafkaProducer.disconnect();
      await clickhouseWriter.disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    logger.error('Failed to start data ingestion service:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
