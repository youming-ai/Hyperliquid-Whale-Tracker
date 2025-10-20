import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import { Logger } from 'winston';
import { TOPICS, TOPIC_SCHEMAS } from '../../config/topics';

export interface KafkaProducerConfig {
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  maxRequestSize?: number;
  requestTimeout?: number;
  retry?: {
    initialRetryTime: number;
    retries: number;
  };
}

export interface MessageMetadata {
  messageId: string;
  timestamp: number;
  source: string;
  version: string;
  correlationId?: string;
  userId?: string;
  traceId?: string;
}

export interface EventMessage {
  metadata: MessageMetadata;
  payload: any;
  headers?: Record<string, string>;
}

export class KafkaEventProducer {
  private kafka: Kafka;
  private producer: Producer;
  private logger: Logger;
  private config: KafkaProducerConfig;
  private isConnected = false;

  constructor(config: KafkaProducerConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      ssl: config.ssl,
      sasl: config.sasl,
      maxRequestSize: config.maxRequestSize || 1048576, // 1MB
      requestTimeout: config.requestTimeout || 30000,
      retry: config.retry || {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 60000,
      allowAutoTopicCreation: false
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.producer.on('producer.connect', () => {
      this.logger.info('Kafka producer connected');
      this.isConnected = true;
    });

    this.producer.on('producer.disconnect', () => {
      this.logger.warn('Kafka producer disconnected');
      this.isConnected = false;
    });

    this.producer.on('producer.network.request_timeout', (payload) => {
      this.logger.error('Kafka producer request timeout:', payload);
    });

    this.producer.on('producer.network.request_queue_size', (payload) => {
      if (payload.size > 100) {
        this.logger.warn('Kafka producer request queue size high:', payload);
      }
    });
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.logger.info('Kafka producer connection established');
    } catch (error) {
      this.logger.error('Failed to connect Kafka producer:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.logger.info('Kafka producer disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Kafka producer:', error);
      throw error;
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createMetadata(
    source: string,
    version = '1.0.0',
    correlationId?: string,
    userId?: string,
    traceId?: string
  ): MessageMetadata {
    return {
      messageId: this.generateMessageId(),
      timestamp: Date.now(),
      source,
      version,
      correlationId,
      userId,
      traceId
    };
  }

  async publishEvent(
    topic: string,
    payload: any,
    options: {
      key?: string;
      headers?: Record<string, string>;
      correlationId?: string;
      userId?: string;
      traceId?: string;
      source?: string;
      version?: string;
    } = {}
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka producer is not connected');
    }

    const {
      key,
      headers = {},
      correlationId,
      userId,
      traceId,
      source = this.config.clientId,
      version = '1.0.0'
    } = options;

    const metadata = this.createMetadata(source, version, correlationId, userId, traceId);
    const message: EventMessage = {
      metadata,
      payload,
      headers: {
        ...headers,
        'content-type': 'application/json',
        'schema-version': version
      }
    };

    const record: ProducerRecord = {
      topic,
      messages: [{
        key: key || message.metadata.messageId,
        value: JSON.stringify(message),
        headers: Object.entries(message.headers).map(([key, value]) => ({
          key,
          value: Buffer.from(value)
        }))
      }]
    };

    try {
      await this.producer.send(record);
      this.logger.debug(`Event published to ${topic}`, {
        messageId: metadata.messageId,
        topic,
        key,
        payloadSize: JSON.stringify(payload).length
      });
    } catch (error) {
      this.logger.error(`Failed to publish event to ${topic}:`, error);
      throw error;
    }
  }

  // Market data events
  async publishMarketPriceUpdate(
    symbol: string,
    price: number,
    volume: number,
    exchange: string,
    options: {
      bid?: number;
      ask?: number;
      source?: string;
      userId?: string;
    } = {}
  ): Promise<void> {
    const payload = {
      symbol,
      price,
      volume,
      timestamp: Date.now(),
      exchange,
      bid: options.bid,
      ask: options.ask,
      source: options.source || 'hyperdash'
    };

    await this.publishEvent(TOPICS.MARKET_PRICE_UPDATES.name, payload, {
      key: symbol,
      userId: options.userId
    });
  }

  async publishMarketTrade(
    tradeId: string,
    symbol: string,
    price: number,
    size: number,
    side: 'buy' | 'sell',
    exchange: string,
    options: {
      buyer?: string;
      seller?: string;
      userId?: string;
    } = {}
  ): Promise<void> {
    const payload = {
      id: tradeId,
      symbol,
      price,
      size,
      side,
      timestamp: Date.now(),
      exchange,
      buyer: options.buyer,
      seller: options.seller
    };

    await this.publishEvent(TOPICS.MARKET_TRADES.name, payload, {
      key: `${symbol}_${tradeId}`,
      userId: options.userId
    });
  }

  // Trader activity events
  async publishTraderPositionUpdate(
    traderId: string,
    traderAddress: string,
    symbol: string,
    side: 'long' | 'short',
    size: number,
    price: number,
    options: {
      leverage?: number;
      unrealizedPnl?: number;
      portfolioValue?: number;
      isWhale?: boolean;
      confidenceScore?: number;
      userId?: string;
    } = {}
  ): Promise<void> {
    const payload = {
      trader_id: traderId,
      trader_address: traderAddress,
      symbol,
      side,
      size,
      price,
      leverage: options.leverage || 1,
      unrealized_pnl: options.unrealizedPnl || 0,
      portfolio_value: options.portfolioValue || 0,
      timestamp: Date.now(),
      is_whale: options.isWhale || false,
      confidence_score: options.confidenceScore || 0
    };

    await this.publishEvent(TOPICS.TRADER_POSITION_UPDATES.name, payload, {
      key: traderId,
      userId: options.userId
    });
  }

  // Copy trading events
  async publishCopyTradeEvent(
    traderId: string,
    followerId: string,
    relationshipId: string,
    symbol: string,
    originalSize: number,
    copySize: number,
    allocationPercentage: number,
    price: number,
    side: 'buy' | 'sell',
    options: {
      feesPaid?: number;
      delayMs?: number;
      userId?: string;
    } = {}
  ): Promise<void> {
    const payload = {
      event_id: this.generateMessageId(),
      trader_id: traderId,
      follower_id: followerId,
      relationship_id: relationshipId,
      symbol,
      original_size: originalSize,
      copy_size: copySize,
      allocation_percentage: allocationPercentage,
      price,
      side,
      timestamp: Date.now(),
      fees_paid: options.feesPaid || 0,
      delay_ms: options.delayMs || 0
    };

    await this.publishEvent(TOPICS.COPY_TRADE_EVENTS.name, payload, {
      key: relationshipId,
      userId: options.userId || followerId
    });
  }

  // User activity events
  async publishUserEvent(
    userId: string,
    eventType: string,
    action: string,
    resource: string,
    metadata: Record<string, any>,
    options: {
      ipAddress?: string;
      userAgent?: string;
      correlationId?: string;
      traceId?: string;
    } = {}
  ): Promise<void> {
    const payload = {
      user_id: userId,
      event_type: eventType,
      action,
      resource,
      timestamp: Date.now(),
      metadata,
      ip_address: options.ipAddress,
      user_agent: options.userAgent
    };

    await this.publishEvent(TOPICS.USER_EVENTS.name, payload, {
      key: userId,
      correlationId: options.correlationId,
      traceId: options.traceId,
      userId
    });
  }

  // System metrics events
  async publishSystemMetrics(
    serviceName: string,
    metrics: {
      cpuUsage: number;
      memoryUsage: number;
      diskUsage: number;
      networkIo: Record<string, number>;
      activeConnections: number;
      responseTimeMs: number;
      errorRate: number;
      throughput: number;
    }
  ): Promise<void> {
    const payload = {
      service: serviceName,
      timestamp: Date.now(),
      cpu_usage: metrics.cpuUsage,
      memory_usage: metrics.memoryUsage,
      disk_usage: metrics.diskUsage,
      network_io: metrics.networkIo,
      active_connections: metrics.activeConnections,
      response_time_ms: metrics.responseTimeMs,
      error_rate: metrics.errorRate,
      throughput: metrics.throughput
    };

    await this.publishEvent(TOPICS.SYSTEM_METRICS.name, payload, {
      key: serviceName
    });
  }

  // Error events
  async publishErrorEvent(
    errorId: string,
    errorType: string,
    message: string,
    stackTrace: string,
    options: {
      userId?: string;
      requestId?: string;
      context?: Record<string, any>;
      correlationId?: string;
      traceId?: string;
    } = {}
  ): Promise<void> {
    const payload = {
      error_id: errorId,
      service: this.config.clientId,
      error_type: errorType,
      message,
      stack_trace: stackTrace,
      timestamp: Date.now(),
      user_id: options.userId,
      request_id: options.requestId,
      context: options.context || {}
    };

    await this.publishEvent(TOPICS.ERROR_EVENTS.name, payload, {
      key: errorType,
      correlationId: options.correlationId,
      traceId: options.traceId,
      userId: options.userId
    });
  }

  // Alert events
  async publishUserAlert(
    userId: string,
    alertType: string,
    message: string,
    data: Record<string, any>,
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      correlationId?: string;
    } = {}
  ): Promise<void> {
    const payload = {
      user_id: userId,
      alert_type: alertType,
      message,
      data,
      priority: options.priority || 'medium',
      timestamp: Date.now()
    };

    await this.publishEvent(TOPICS.USER_ALERTS.name, payload, {
      key: userId,
      correlationId: options.correlationId,
      userId
    });
  }

  // Batch publish for high-throughput scenarios
  async publishBatch(records: Array<{
    topic: string;
    payload: any;
    key?: string;
    headers?: Record<string, string>;
    userId?: string;
  }>): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka producer is not connected');
    }

    const kafkaRecords: ProducerRecord = {
      topic: records[0].topic, // All records in batch must have same topic for now
      messages: records.map(record => {
        const metadata = this.createMetadata(this.config.clientId, '1.0.0', undefined, record.userId);
        const message: EventMessage = {
          metadata,
          payload: record.payload,
          headers: {
            ...record.headers,
            'content-type': 'application/json'
          }
        };

        return {
          key: record.key || metadata.messageId,
          value: JSON.stringify(message),
          headers: Object.entries(message.headers).map(([key, value]) => ({
            key,
            value: Buffer.from(value)
          }))
        };
      })
    };

    try {
      await this.producer.send(kafkaRecords);
      this.logger.info(`Batch of ${records.length} events published`);
    } catch (error) {
      this.logger.error('Failed to publish batch events:', error);
      throw error;
    }
  }

  // Transaction support
  async sendTransaction(
    records: Array<{
      topic: string;
      payload: any;
      key?: string;
      headers?: Record<string, string>;
      userId?: string;
    }>
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka producer is not connected');
    }

    const transaction = this.producer.transaction();

    try {
      await transaction.begin();

      for (const record of records) {
        const metadata = this.createMetadata(this.config.clientId, '1.0.0', undefined, record.userId);
        const message: EventMessage = {
          metadata,
          payload: record.payload,
          headers: {
            ...record.headers,
            'content-type': 'application/json'
          }
        };

        await transaction.send({
          topic: record.topic,
          messages: [{
            key: record.key || metadata.messageId,
            value: JSON.stringify(message),
            headers: Object.entries(message.headers).map(([key, value]) => ({
              key,
              value: Buffer.from(value)
            }))
          }]
        });
      }

      await transaction.commit();
      this.logger.info(`Transaction with ${records.length} messages committed`);
    } catch (error) {
      await transaction.abort();
      this.logger.error('Transaction failed, aborted:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    try {
      if (!this.isConnected) {
        return {
          status: 'unhealthy',
          details: { error: 'Producer not connected' }
        };
      }

      // Try to get producer metadata
      const metadata = await this.producer.metadata();

      return {
        status: 'healthy',
        details: {
          brokers: metadata.brokers.length,
          topics: Object.keys(metadata.topicMetadata).length,
          clientId: this.config.clientId
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}
