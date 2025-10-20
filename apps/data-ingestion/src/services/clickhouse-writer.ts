import { createClient } from '@clickhouse/client';
import { logger } from '../utils/logger';
import { config } from '../config';

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

export class ClickHouseWriter {
  private client: any;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      host: config.clickhouse.url,
      database: config.clickhouse.database,
      username: config.clickhouse.user,
      password: config.clickhouse.password,
      clickhouse_settings: {
        async_insert: 1,
        wait_for_async_insert: 1,
      },
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.ping();
      this.isConnected = true;
      logger.info('Connected to ClickHouse');
      await this.ensureTables();
    } catch (error) {
      logger.error('Failed to connect to ClickHouse:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      logger.info('Disconnected from ClickHouse');
    }
  }

  private async ensureTables(): Promise<void> {
    try {
      // Create trades table
      await this.client.command({
        query: `
          CREATE TABLE IF NOT EXISTS hyperliquid_trades (
            symbol String,
            side Enum('buy' = 1, 'sell' = 2),
            price Decimal(20, 8),
            size Decimal(20, 8),
            timestamp DateTime64(3),
            hash String,
            date Date MATERIALIZED toDate(timestamp)
          ) ENGINE = MergeTree()
          PARTITION BY date
          ORDER BY (symbol, timestamp)
          SETTINGS index_granularity = 8192
        `,
      });

      // Create quotes table
      await this.client.command({
        query: `
          CREATE TABLE IF NOT EXISTS hyperliquid_quotes (
            symbol String,
            bid Decimal(20, 8),
            ask Decimal(20, 8),
            bidSize Decimal(20, 8),
            askSize Decimal(20, 8),
            timestamp DateTime64(3),
            date Date MATERIALIZED toDate(timestamp)
          ) ENGINE = MergeTree()
          PARTITION BY date
          ORDER BY (symbol, timestamp)
          SETTINGS index_granularity = 8192
        `,
      });

      // Create funding table
      await this.client.command({
        query: `
          CREATE TABLE IF NOT EXISTS hyperliquid_funding (
            symbol String,
            fundingRate Decimal(10, 8),
            fundingTime DateTime64(3),
            date Date MATERIALIZED toDate(fundingTime)
          ) ENGINE = MergeTree()
          PARTITION BY date
          ORDER BY (symbol, fundingTime)
          SETTINGS index_granularity = 8192
        `,
      });

      // Create open interest table
      await this.client.command({
        query: `
          CREATE TABLE IF NOT EXISTS hyperliquid_open_interest (
            symbol String,
            openInterest Decimal(20, 8),
            timestamp DateTime64(3),
            date Date MATERIALIZED toDate(timestamp)
          ) ENGINE = MergeTree()
          PARTITION BY date
          ORDER BY (symbol, timestamp)
          SETTINGS index_granularity = 8192
        `,
      });

      // Create liquidations table
      await this.client.command({
        query: `
          CREATE TABLE IF NOT EXISTS hyperliquid_liquidations (
            symbol String,
            side Enum('buy' = 1, 'sell' = 2),
            price Decimal(20, 8),
            size Decimal(20, 8),
            timestamp DateTime64(3),
            hash String,
            date Date MATERIALIZED toDate(timestamp)
          ) ENGINE = MergeTree()
          PARTITION BY date
          ORDER BY (symbol, timestamp)
          SETTINGS index_granularity = 8192
        `,
      });

      // Create symbols table
      await this.client.command({
        query: `
          CREATE TABLE IF NOT EXISTS hyperliquid_symbols (
            symbol String,
            baseCurrency String,
            quoteCurrency String,
            maxLeverage UInt32,
            type String,
            updated_at DateTime64(3) DEFAULT now64()
          ) ENGINE = ReplacingMergeTree(updated_at)
          ORDER BY symbol
          SETTINGS index_granularity = 8192
        `,
      });

      logger.info('ClickHouse tables ensured');
    } catch (error) {
      logger.error('Failed to ensure ClickHouse tables:', error);
      throw error;
    }
  }

  async writeTrade(trade: TradeData): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.client.insert({
        table: 'hyperliquid_trades',
        values: [{
          symbol: trade.symbol,
          side: trade.side,
          price: trade.price,
          size: trade.size,
          timestamp: trade.timestamp,
          hash: trade.hash,
        }],
        format: 'JSONEachRow',
      });
    } catch (error) {
      logger.error('Failed to write trade to ClickHouse:', error);
    }
  }

  async writeQuote(quote: QuoteData): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.client.insert({
        table: 'hyperliquid_quotes',
        values: [{
          symbol: quote.symbol,
          bid: quote.bid,
          ask: quote.ask,
          bidSize: quote.bidSize,
          askSize: quote.askSize,
          timestamp: quote.timestamp,
        }],
        format: 'JSONEachRow',
      });
    } catch (error) {
      logger.error('Failed to write quote to ClickHouse:', error);
    }
  }

  async writeFunding(funding: FundingData): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.client.insert({
        table: 'hyperliquid_funding',
        values: [{
          symbol: funding.symbol,
          fundingRate: funding.fundingRate,
          fundingTime: funding.fundingTime,
        }],
        format: 'JSONEachRow',
      });
    } catch (error) {
      logger.error('Failed to write funding to ClickHouse:', error);
    }
  }

  async writeOpenInterest(openInterest: OpenInterestData[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (openInterest.length === 0) return;

    try {
      await this.client.insert({
        table: 'hyperliquid_open_interest',
        values: openInterest.map(oi => ({
          symbol: oi.symbol,
          openInterest: oi.openInterest,
          timestamp: oi.timestamp,
        })),
        format: 'JSONEachRow',
      });
    } catch (error) {
      logger.error('Failed to write open interest to ClickHouse:', error);
    }
  }

  async writeLiquidations(liquidations: LiquidationData[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (liquidations.length === 0) return;

    try {
      await this.client.insert({
        table: 'hyperliquid_liquidations',
        values: liquidations.map(liq => ({
          symbol: liq.symbol,
          side: liq.side,
          price: liq.price,
          size: liq.size,
          timestamp: liq.timestamp,
          hash: liq.hash,
        })),
        format: 'JSONEachRow',
      });
    } catch (error) {
      logger.error('Failed to write liquidations to ClickHouse:', error);
    }
  }

  async writeSymbols(symbols: SymbolData[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (symbols.length === 0) return;

    try {
      await this.client.insert({
        table: 'hyperliquid_symbols',
        values: symbols.map(symbol => ({
          symbol: symbol.symbol,
          baseCurrency: symbol.baseCurrency,
          quoteCurrency: symbol.quoteCurrency,
          maxLeverage: symbol.maxLeverage,
          type: symbol.type,
        })),
        format: 'JSONEachRow',
      });
    } catch (error) {
      logger.error('Failed to write symbols to ClickHouse:', error);
    }
  }

  // Batch write operations
  async writeTrades(trades: TradeData[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (trades.length === 0) return;

    try {
      await this.client.insert({
        table: 'hyperliquid_trades',
        values: trades.map(trade => ({
          symbol: trade.symbol,
          side: trade.side,
          price: trade.price,
          size: trade.size,
          timestamp: trade.timestamp,
          hash: trade.hash,
        })),
        format: 'JSONEachRow',
      });
    } catch (error) {
      logger.error('Failed to write trades to ClickHouse:', error);
    }
  }

  async writeQuotes(quotes: QuoteData[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (quotes.length === 0) return;

    try {
      await this.client.insert({
        table: 'hyperliquid_quotes',
        values: quotes.map(quote => ({
          symbol: quote.symbol,
          bid: quote.bid,
          ask: quote.ask,
          bidSize: quote.bidSize,
          askSize: quote.askSize,
          timestamp: quote.timestamp,
        })),
        format: 'JSONEachRow',
      });
    } catch (error) {
      logger.error('Failed to write quotes to ClickHouse:', error);
    }
  }
}
