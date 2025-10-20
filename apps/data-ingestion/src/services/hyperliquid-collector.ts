import WebSocket from 'ws';
import axios from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { config } from '../config';
import { KafkaProducer } from './kafka-producer';
import { ClickHouseWriter } from './clickhouse-writer';

interface HyperliquidTrade {
  side: 'B' | 'S';
  px: string;
  sz: string;
  time: number;
  hash: string;
  coin: string;
}

interface HyperliquidFunding {
  coin: string;
  fundingRate: string;
  fundingTime: number;
}

interface HyperliquidOpenInterest {
  coin: string;
  openInterest: string;
  time: number;
}

interface HyperliquidLiquidation {
  side: 'B' | 'S';
  px: string;
  sz: string;
  time: number;
  hash: string;
  coin: string;
}

interface CollectionServices {
  kafkaProducer: KafkaProducer;
  clickhouseWriter: ClickHouseWriter;
}

export class HyperliquidDataCollector extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private services: CollectionServices;
  private isRunning = false;

  constructor(services: CollectionServices) {
    super();
    this.services = services;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Data collector is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting Hyperliquid data collection...');

    // Start with HTTP data collection
    await this.startHttpCollection();

    // Then start WebSocket for real-time data
    await this.startWebSocketCollection();

    // Start periodic metadata collection
    this.startPeriodicCollection();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('Stopping Hyperliquid data collection...');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    logger.info('Data collection stopped');
  }

  private async startHttpCollection(): Promise<void> {
    // Initial data fetch
    await this.fetchMeta();

    // Set up periodic meta data collection
    setInterval(async () => {
      if (this.isRunning) {
        await this.fetchMeta();
      }
    }, 60000); // Every minute
  }

  private async startWebSocketCollection(): Promise<void> {
    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    if (!this.isRunning) return;

    logger.info('Connecting to Hyperliquid WebSocket...');

    this.ws = new WebSocket(config.hyperliquid.wsUrl);

    this.ws.on('open', () => {
      logger.info('Connected to Hyperliquid WebSocket');
      this.subscribeToData();
      this.startHeartbeat();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleWebSocketMessage(data);
    });

    this.ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      logger.warn(`WebSocket closed: ${code} ${reason.toString()}`);
      this.handleWebSocketReconnect();
    });
  }

  private subscribeToData(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Subscribe to all trades
    this.ws.send(JSON.stringify({
      method: 'subscribe',
      stream: 'trades'
    }));

    // Subscribe to all quotes
    this.ws.send(JSON.stringify({
      method: 'subscribe',
      stream: 'quote'
    }));

    // Subscribe to funding rates
    this.ws.send(JSON.stringify({
      method: 'subscribe',
      stream: 'funding'
    }));

    logger.info('Subscribed to Hyperliquid data streams');
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000); // 30 seconds
  }

  private handleWebSocketMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      if (message.channel === 'trades' && message.data) {
        this.handleTrades(message.data);
      } else if (message.channel === 'quote' && message.data) {
        this.handleQuotes(message.data);
      } else if (message.channel === 'funding' && message.data) {
        this.handleFunding(message.data);
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleTrades(trades: HyperliquidTrade[]): void {
    trades.forEach(trade => {
      const processedTrade = {
        symbol: trade.coin,
        side: trade.side === 'B' ? 'buy' : 'sell',
        price: parseFloat(trade.px),
        size: parseFloat(trade.sz),
        timestamp: new Date(trade.time),
        hash: trade.hash,
      };

      // Send to Kafka
      this.services.kafkaProducer.sendTrade(processedTrade);

      // Send to ClickHouse
      this.services.clickhouseWriter.writeTrade(processedTrade);
    });
  }

  private handleQuotes(quotes: any[]): void {
    quotes.forEach(quote => {
      const processedQuote = {
        symbol: quote.coin,
        bid: parseFloat(quote.bidPx),
        ask: parseFloat(quote.askPx),
        bidSize: parseFloat(quote.bidSz),
        askSize: parseFloat(quote.askSz),
        timestamp: new Date(quote.time),
      };

      // Send to Kafka
      this.services.kafkaProducer.sendQuote(processedQuote);

      // Send to ClickHouse
      this.services.clickhouseWriter.writeQuote(processedQuote);
    });
  }

  private handleFunding(fundingData: HyperliquidFunding[]): void {
    fundingData.forEach(funding => {
      const processedFunding = {
        symbol: funding.coin,
        fundingRate: parseFloat(funding.fundingRate),
        fundingTime: new Date(funding.fundingTime),
      };

      // Send to Kafka
      this.services.kafkaProducer.sendFunding(processedFunding);

      // Send to ClickHouse
      this.services.clickhouseWriter.writeFunding(processedFunding);
    });
  }

  private async fetchMeta(): Promise<void> {
    try {
      const response = await axios.get(`${config.hyperliquid.apiUrl}/meta`);
      const meta = response.data;

      if (meta.symbols) {
        const symbols = meta.symbols.map((symbol: any) => ({
          symbol: symbol.name,
          baseCurrency: symbol.baseCurrency,
          quoteCurrency: symbol.quoteCurrency,
          maxLeverage: symbol.maxLeverage,
          type: symbol.type || 'perpetual',
        }));

        // Send symbols data to Kafka and ClickHouse
        this.services.kafkaProducer.sendSymbols(symbols);
        await this.services.clickhouseWriter.writeSymbols(symbols);
      }

      logger.debug('Fetched and stored meta data');
    } catch (error) {
      logger.error('Failed to fetch meta data:', error);
    }
  }

  private startPeriodicCollection(): void {
    // Collect open interest data every 30 seconds
    setInterval(async () => {
      if (this.isRunning) {
        await this.fetchOpenInterest();
      }
    }, 30000);

    // Collect liquidation data every 10 seconds
    setInterval(async () => {
      if (this.isRunning) {
        await this.fetchLiquidations();
      }
    }, 10000);
  }

  private async fetchOpenInterest(): Promise<void> {
    try {
      const response = await axios.get(`${config.hyperliquid.apiUrl}/openInterest`);
      const openInterestData: HyperliquidOpenInterest[] = response.data;

      const processed = openInterestData.map(oi => ({
        symbol: oi.coin,
        openInterest: parseFloat(oi.openInterest),
        timestamp: new Date(oi.time),
      }));

      // Send to Kafka
      this.services.kafkaProducer.sendOpenInterest(processed);

      // Send to ClickHouse
      await this.services.clickhouseWriter.writeOpenInterest(processed);

    } catch (error) {
      logger.error('Failed to fetch open interest:', error);
    }
  }

  private async fetchLiquidations(): Promise<void> {
    try {
      const response = await axios.get(`${config.hyperliquid.apiUrl}/liquidations`);
      const liquidationData: HyperliquidLiquidation[] = response.data;

      const processed = liquidationData.map(liq => ({
        symbol: liq.coin,
        side: liq.side === 'B' ? 'buy' : 'sell',
        price: parseFloat(liq.px),
        size: parseFloat(liq.sz),
        timestamp: new Date(liq.time),
        hash: liq.hash,
      }));

      // Send to Kafka
      this.services.kafkaProducer.sendLiquidations(processed);

      // Send to ClickHouse
      await this.services.clickhouseWriter.writeLiquidations(processed);

    } catch (error) {
      logger.error('Failed to fetch liquidations:', error);
    }
  }

  private handleWebSocketReconnect(): void {
    if (!this.isRunning) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      logger.info('Attempting to reconnect to WebSocket...');
      this.connectWebSocket();
    }, 5000);
  }
}
