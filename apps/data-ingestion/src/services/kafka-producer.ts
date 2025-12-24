import { Kafka, type Producer } from 'kafkajs';
import { config } from '../config';
import { logger } from '../utils/logger';

interface TradeData {
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  timestamp: Date;
  hash: string;
}

interface QuoteData {
  symbol: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  timestamp: Date;
}

interface FundingData {
  symbol: string;
  fundingRate: number;
  fundingTime: Date;
}

interface OpenInterestData {
  symbol: string;
  openInterest: number;
  timestamp: Date;
}

interface LiquidationData {
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  timestamp: Date;
  hash: string;
}

interface SymbolData {
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  maxLeverage: number;
  type: string;
}

export class KafkaProducer {
  private kafka: Kafka;
  private producer: Producer;
  private isConnected = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.isConnected = true;
      logger.info('Connected to Kafka');
    } catch (error) {
      logger.error('Failed to connect to Kafka:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from Kafka');
    }
  }

  async sendTrade(trade: TradeData): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.producer.send({
        topic: config.topics.trades,
        messages: [
          {
            key: trade.symbol,
            value: JSON.stringify({
              ...trade,
              timestamp: trade.timestamp.toISOString(),
            }),
            timestamp: trade.timestamp.getTime(),
          },
        ],
      });
    } catch (error) {
      logger.error('Failed to send trade to Kafka:', error);
    }
  }

  async sendQuote(quote: QuoteData): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.producer.send({
        topic: config.topics.quotes,
        messages: [
          {
            key: quote.symbol,
            value: JSON.stringify({
              ...quote,
              timestamp: quote.timestamp.toISOString(),
            }),
            timestamp: quote.timestamp.getTime(),
          },
        ],
      });
    } catch (error) {
      logger.error('Failed to send quote to Kafka:', error);
    }
  }

  async sendFunding(funding: FundingData): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.producer.send({
        topic: config.topics.funding,
        messages: [
          {
            key: funding.symbol,
            value: JSON.stringify({
              ...funding,
              fundingTime: funding.fundingTime.toISOString(),
            }),
            timestamp: funding.fundingTime.getTime(),
          },
        ],
      });
    } catch (error) {
      logger.error('Failed to send funding to Kafka:', error);
    }
  }

  async sendOpenInterest(openInterest: OpenInterestData[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (openInterest.length === 0) return;

    try {
      await this.producer.send({
        topic: config.topics.openInterest,
        messages: openInterest.map((oi) => ({
          key: oi.symbol,
          value: JSON.stringify({
            ...oi,
            timestamp: oi.timestamp.toISOString(),
          }),
          timestamp: oi.timestamp.getTime(),
        })),
      });
    } catch (error) {
      logger.error('Failed to send open interest to Kafka:', error);
    }
  }

  async sendLiquidations(liquidations: LiquidationData[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (liquidations.length === 0) return;

    try {
      await this.producer.send({
        topic: config.topics.liquidations,
        messages: liquidations.map((liq) => ({
          key: liq.symbol,
          value: JSON.stringify({
            ...liq,
            timestamp: liq.timestamp.toISOString(),
          }),
          timestamp: liq.timestamp.getTime(),
        })),
      });
    } catch (error) {
      logger.error('Failed to send liquidations to Kafka:', error);
    }
  }

  async sendSymbols(symbols: SymbolData[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (symbols.length === 0) return;

    try {
      await this.producer.send({
        topic: 'hyperliquid.symbols',
        messages: symbols.map((symbol) => ({
          key: symbol.symbol,
          value: JSON.stringify({
            ...symbol,
            updated_at: new Date().toISOString(),
          }),
        })),
      });
    } catch (error) {
      logger.error('Failed to send symbols to Kafka:', error);
    }
  }

  // Batch operations
  async sendTrades(trades: TradeData[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (trades.length === 0) return;

    try {
      await this.producer.send({
        topic: config.topics.trades,
        messages: trades.map((trade) => ({
          key: trade.symbol,
          value: JSON.stringify({
            ...trade,
            timestamp: trade.timestamp.toISOString(),
          }),
          timestamp: trade.timestamp.getTime(),
        })),
      });
    } catch (error) {
      logger.error('Failed to send trades to Kafka:', error);
    }
  }

  async sendQuotes(quotes: QuoteData[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (quotes.length === 0) return;

    try {
      await this.producer.send({
        topic: config.topics.quotes,
        messages: quotes.map((quote) => ({
          key: quote.symbol,
          value: JSON.stringify({
            ...quote,
            timestamp: quote.timestamp.toISOString(),
          }),
          timestamp: quote.timestamp.getTime(),
        })),
      });
    } catch (error) {
      logger.error('Failed to send quotes to Kafka:', error);
    }
  }
}
