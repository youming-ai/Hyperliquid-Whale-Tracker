export interface TopicConfig {
  name: string;
  partitions: number;
  replicationFactor: number;
  config?: Record<string, string>;
}

export interface TopicSchemas {
  key?: string;
  value: string;
}

// Event streaming topics for the HyperDash platform
export const TOPICS: Record<string, TopicConfig> = {
  // Market Data Topics
  MARKET_PRICE_UPDATES: {
    name: 'market-price-updates',
    partitions: 12,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '3600000', // 1 hour
      'segment.ms': '300000', // 5 minutes
      'compression.type': 'lz4'
    }
  },

  MARKET_TRADES: {
    name: 'market-trades',
    partitions: 24,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '86400000', // 24 hours
      'segment.ms': '600000', // 10 minutes
      'compression.type': 'lz4'
    }
  },

  MARKET_OHLCV: {
    name: 'market-ohlcv',
    partitions: 6,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'compact,delete',
      'retention.ms': '2592000000', // 30 days
      'segment.ms': '3600000', // 1 hour
      'compression.type': 'zstd',
      'min.cleanable.dirty.ratio': '0.01'
    }
  },

  // Trader Activity Topics
  TRADER_POSITION_UPDATES: {
    name: 'trader-position-updates',
    partitions: 8,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'compact,delete',
      'retention.ms': '604800000', // 7 days
      'segment.ms': '1800000', // 30 minutes
      'compression.type': 'lz4'
    }
  },

  TRADER_PROFIT_LOSS: {
    name: 'trader-profit-loss',
    partitions: 6,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'compact,delete',
      'retention.ms': '2592000000', // 30 days
      'segment.ms': '3600000', // 1 hour
      'compression.type': 'zstd'
    }
  },

  TRADER_RANKINGS: {
    name: 'trader-rankings',
    partitions: 3,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'compact',
      'compression.type': 'zstd',
      'max.compaction.lag.ms': '3600000' // 1 hour
    }
  },

  // Copy Trading Topics
  COPY_TRADE_EVENTS: {
    name: 'copy-trade-events',
    partitions: 8,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '2592000000', // 30 days
      'segment.ms': '1800000', // 30 minutes
      'compression.type': 'lz4'
    }
  },

  COPY_PERFORMANCE: {
    name: 'copy-performance',
    partitions: 6,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'compact,delete',
      'retention.ms': '2592000000', // 30 days
      'segment.ms': '3600000', // 1 hour
      'compression.type': 'zstd'
    }
  },

  COPY_ALIGNMENT: {
    name: 'copy-alignment',
    partitions: 6,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '604800000', // 7 days
      'segment.ms': '1800000', // 30 minutes
      'compression.type': 'lz4'
    }
  },

  // User Activity Topics
  USER_EVENTS: {
    name: 'user-events',
    partitions: 4,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '2592000000', // 30 days
      'segment.ms': '3600000', // 1 hour
      'compression.type': 'lz4'
    }
  },

  USER_ALERTS: {
    name: 'user-alerts',
    partitions: 4,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '604800000', // 7 days
      'segment.ms': '1800000', // 30 minutes
      'compression.type': 'lz4'
    }
  },

  USER_NOTIFICATIONS: {
    name: 'user-notifications',
    partitions: 4,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '259200000', // 3 days
      'segment.ms': '900000', // 15 minutes
      'compression.type': 'lz4'
    }
  },

  // System Events Topics
  SYSTEM_METRICS: {
    name: 'system-metrics',
    partitions: 3,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '86400000', // 24 hours
      'segment.ms': '300000', // 5 minutes
      'compression.type': 'lz4'
    }
  },

  API_METRICS: {
    name: 'api-metrics',
    partitions: 3,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '86400000', // 24 hours
      'segment.ms': '300000', // 5 minutes
      'compression.type': 'lz4'
    }
  },

  ERROR_EVENTS: {
    name: 'error-events',
    partitions: 3,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '259200000', // 3 days
      'segment.ms': '900000', // 15 minutes
      'compression.type': 'lz4'
    }
  },

  // External Data Topics
  SOCIAL_SENTIMENT: {
    name: 'social-sentiment',
    partitions: 6,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '86400000', // 24 hours
      'segment.ms': '600000', // 10 minutes
      'compression.type': 'lz4'
    }
  },

  ONCHAIN_EVENTS: {
    name: 'onchain-events',
    partitions: 8,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '604800000', // 7 days
      'segment.ms': '1800000', // 30 minutes
      'compression.type': 'lz4'
    }
  },

  // Analytics Topics
  ANALYTICS_EVENTS: {
    name: 'analytics-events',
    partitions: 4,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '86400000', // 24 hours
      'segment.ms': '600000', // 10 minutes
      'compression.type': 'lz4'
    }
  },

  // Dead Letter Queue
  DEAD_LETTER_QUEUE: {
    name: 'dead-letter-queue',
    partitions: 3,
    replicationFactor: 3,
    config: {
      'cleanup.policy': 'delete',
      'retention.ms': '2592000000', // 30 days
      'segment.ms': '3600000', // 1 hour
      'compression.type': 'lz4'
    }
  }
};

// Topic schemas (Avro format)
export const TOPIC_SCHEMAS: Record<string, TopicSchemas> = {
  'market-price-updates': {
    key: 'string',
    value: `
      {
        "type": "record",
        "name": "MarketPriceUpdate",
        "fields": [
          {"name": "symbol", "type": "string"},
          {"name": "price", "type": "double"},
          {"name": "volume", "type": "double"},
          {"name": "timestamp", "type": "long"},
          {"name": "exchange", "type": "string"},
          {"name": "bid", "type": ["null", "double"], "default": null},
          {"name": "ask", "type": ["null", "double"], "default": null},
          {"name": "source", "type": "string"}
        ]
      }
    `
  },

  'market-trades': {
    key: 'string',
    value: `
      {
        "type": "record",
        "name": "MarketTrade",
        "fields": [
          {"name": "id", "type": "string"},
          {"name": "symbol", "type": "string"},
          {"name": "price", "type": "double"},
          {"name": "size", "type": "double"},
          {"name": "side", "type": "string"},
          {"name": "timestamp", "type": "long"},
          {"name": "exchange", "type": "string"},
          {"name": "buyer", "type": ["null", "string"], "default": null},
          {"name": "seller", "type": ["null", "string"], "default": null}
        ]
      }
    `
  },

  'trader-position-updates': {
    key: 'string',
    value: `
      {
        "type": "record",
        "name": "TraderPositionUpdate",
        "fields": [
          {"name": "trader_id", "type": "string"},
          {"name": "trader_address", "type": "string"},
          {"name": "symbol", "type": "string"},
          {"name": "side", "type": "string"},
          {"name": "size", "type": "double"},
          {"name": "price", "type": "double"},
          {"name": "leverage", "type": "double"},
          {"name": "unrealized_pnl", "type": "double"},
          {"name": "portfolio_value", "type": "double"},
          {"name": "timestamp", "type": "long"},
          {"name": "is_whale", "type": "boolean"},
          {"name": "confidence_score", "type": "double"}
        ]
      }
    `
  },

  'copy-trade-events': {
    key: 'string',
    value: `
      {
        "type": "record",
        "name": "CopyTradeEvent",
        "fields": [
          {"name": "event_id", "type": "string"},
          {"name": "trader_id", "type": "string"},
          {"name": "follower_id", "type": "string"},
          {"name": "relationship_id", "type": "string"},
          {"name": "symbol", "type": "string"},
          {"name": "original_size", "type": "double"},
          {"name": "copy_size", "type": "double"},
          {"name": "allocation_percentage", "type": "double"},
          {"name": "price", "type": "double"},
          {"name": "side", "type": "string"},
          {"name": "timestamp", "type": "long"},
          {"name": "fees_paid", "type": "double"},
          {"name": "delay_ms", "type": "long"}
        ]
      }
    `
  },

  'user-events': {
    key: 'string',
    value: `
      {
        "type": "record",
        "name": "UserEvent",
        "fields": [
          {"name": "user_id", "type": "string"},
          {"name": "event_type", "type": "string"},
          {"name": "action", "type": "string"},
          {"name": "resource", "type": "string"},
          {"name": "timestamp", "type": "long"},
          {"name": "metadata", "type": {"type": "map", "values": "string"}},
          {"name": "ip_address", "type": ["null", "string"], "default": null},
          {"name": "user_agent", "type": ["null", "string"], "default": null}
        ]
      }
    `
  },

  'system-metrics': {
    key: 'string',
    value: `
      {
        "type": "record",
        "name": "SystemMetrics",
        "fields": [
          {"name": "service", "type": "string"},
          {"name": "timestamp", "type": "long"},
          {"name": "cpu_usage", "type": "double"},
          {"name": "memory_usage", "type": "double"},
          {"name": "disk_usage", "type": "double"},
          {"name": "network_io", "type": {"type": "map", "values": "double"}},
          {"name": "active_connections", "type": "int"},
          {"name": "response_time_ms", "type": "double"},
          {"name": "error_rate", "type": "double"},
          {"name": "throughput", "type": "double"}
        ]
      }
    `
  },

  'error-events': {
    key: 'string',
    value: `
      {
        "type": "record",
        "name": "ErrorEvent",
        "fields": [
          {"name": "error_id", "type": "string"},
          {"name": "service", "type": "string"},
          {"name": "error_type", "type": "string"},
          {"name": "message", "type": "string"},
          {"name": "stack_trace", "type": "string"},
          {"name": "timestamp", "type": "long"},
          {"name": "user_id", "type": ["null", "string"], "default": null},
          {"name": "request_id", "type": ["null", "string"], "default": null},
          {"name": "context", "type": {"type": "map", "values": "string"}}
        ]
      }
    `
  },

  'social-sentiment': {
    key: 'string',
    value: `
      {
        "type": "record",
        "name": "SocialSentiment",
        "fields": [
          {"name": "symbol", "type": "string"},
          {"name": "platform", "type": "string"},
          {"name": "sentiment_score", "type": "double"},
          {"name": "mention_count", "type": "int"},
          {"name": "positive_count", "type": "int"},
          {"name": "negative_count", "type": "int"},
          {"name": "neutral_count", "type": "int"},
          {"name": "influence_score", "type": "double"},
          {"name": "keywords", "type": {"type": "array", "items": "string"}},
          {"name": "timestamp", "type": "long"}
        ]
      }
    `
  },

  'onchain-events': {
    key: 'string',
    value: `
      {
        "type": "record",
        "name": "OnchainEvent",
        "fields": [
          {"name": "event_type", "type": "string"},
          {"name": "token_address", "type": "string"},
          {"name": "symbol", "type": "string"},
          {"name": "amount", "type": "double"},
          {"name": "price_usd", "type": ["null", "double"], "default": null},
          {"name": "from_address", "type": "string"},
          {"name": "to_address", "type": "string"},
          {"name": "transaction_hash", "type": "string"},
          {"name": "block_number", "type": "long"},
          {"name": "timestamp", "type": "long"},
          {"name": "gas_used", "type": "long"},
          {"name": "gas_price", "type": "double"}
        ]
      }
    `
  }
};

// Consumer groups
export const CONSUMER_GROUPS = {
  MARKET_DATA_PROCESSOR: 'market-data-processor',
  TRADER_ANALYTICS: 'trader-analytics',
  COPY_TRADING_ENGINE: 'copy-trading-engine',
  NOTIFICATION_SERVICE: 'notification-service',
  ANALYTICS_SERVICE: 'analytics-service',
  MONITORING_SERVICE: 'monitoring-service',
  DATA_INGESTION: 'data-ingestion',
  ERROR_PROCESSOR: 'error-processor'
};

// Topic partitions by service for distribution
export const TOPIC_ASSIGNMENTS = {
  marketDataService: [
    'market-price-updates',
    'market-trades',
    'market-ohlcv'
  ],
  traderAnalyticsService: [
    'trader-position-updates',
    'trader-profit-loss',
    'trader-rankings'
  ],
  copyTradingService: [
    'copy-trade-events',
    'copy-performance',
    'copy-alignment'
  ],
  userService: [
    'user-events',
    'user-alerts',
    'user-notifications'
  ],
  systemService: [
    'system-metrics',
    'api-metrics',
    'error-events'
  ],
  externalDataService: [
    'social-sentiment',
    'onchain-events'
  ],
  analyticsService: [
    'analytics-events'
  ]
};
