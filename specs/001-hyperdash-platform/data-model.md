# Data Model: HyperDash Platform

**Date**: 2025-01-18  
**Version**: 1.0  
**Status**: Draft

## Overview

This document defines the data models for the HyperDash platform, covering both OLTP (PostgreSQL) and OLAP (ClickHouse) storage systems. The models support real-time market analytics, copy trading, user management, and billing operations.

## Database Architecture

### PostgreSQL (OLTP)
- **Purpose**: Transactional data, user management, trading operations, billing
- **Schema**: ACID compliance with relational integrity
- **Access Patterns**: CRUD operations, financial transactions, authentication

### ClickHouse (OLAP)
- **Purpose**: Time-series analytics, market data, performance metrics
- **Schema**: Optimized for analytical queries and aggregations
- **Access Patterns**: High-throughput ingestion, analytical queries, time-series analysis

## PostgreSQL Schema (OLTP)

### Core Entities

#### Users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    wallet_addr TEXT UNIQUE NOT NULL,
    kyc_level INTEGER DEFAULT 0, -- 0: unverified, 1: basic, 2: full
    status TEXT DEFAULT 'active', -- active, suspended, closed
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_users_wallet_addr (wallet_addr),
    INDEX idx_users_email (email),
    INDEX idx_users_kyc_level (kyc_level)
);

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### Agent Wallets
```sql
CREATE TABLE agent_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exchange TEXT NOT NULL DEFAULT 'hyperliquid',
    addr TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active', -- active, inactive, suspended
    min_order_usd DECIMAL(18, 8) DEFAULT 5.0,
    max_leverage INTEGER DEFAULT 5,
    permissions JSONB DEFAULT '{"trade": true, "withdraw": false}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_min_order_positive CHECK (min_order_usd > 0),
    CONSTRAINT chk_max_leverage_positive CHECK (max_leverage > 0),
    
    -- Indexes
    INDEX idx_agent_wallets_user_id (user_id),
    INDEX idx_agent_wallets_addr (addr),
    INDEX idx_agent_wallets_status (status)
);
```

#### Traders
```sql
CREATE TABLE traders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alias TEXT NOT NULL,
    src_uid TEXT NOT NULL, -- Original UID from exchange
    addr TEXT, -- Blockchain address if available
    exchange TEXT NOT NULL DEFAULT 'hyperliquid',
    tags TEXT[] DEFAULT '{}',
    public_score DECIMAL(5, 2), -- 0-100 score
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_public_score_range CHECK (public_score >= 0 AND public_score <= 100),
    
    -- Indexes
    INDEX idx_traders_src_uid (src_uid),
    INDEX idx_traders_exchange (exchange),
    INDEX idx_traders_public_score (public_score DESC),
    INDEX idx_traders_is_active (is_active),
    
    -- Unique constraint per exchange
    UNIQUE(exchange, src_uid)
);
```

#### Copy Strategies
```sql
CREATE TABLE copy_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'paused', -- paused, active, error, terminated
    mode TEXT DEFAULT 'portfolio', -- portfolio, single_trader
    
    -- Risk parameters
    max_leverage DECIMAL(5, 2) DEFAULT 5.0,
    max_position_usd DECIMAL(18, 8),
    slippage_bps INTEGER DEFAULT 10,
    min_order_usd DECIMAL(18, 8) DEFAULT 5.0,
    
    -- Strategy settings
    follow_new_entries_only BOOLEAN DEFAULT true,
    auto_rebalance BOOLEAN DEFAULT true,
    rebalance_threshold_bps INTEGER DEFAULT 50,
    
    -- Performance tracking
    total_pnl DECIMAL(18, 8) DEFAULT 0,
    total_fees DECIMAL(18, 8) DEFAULT 0,
    alignment_rate DECIMAL(5, 2) DEFAULT 100.0, -- Percentage
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_max_leverage_positive CHECK (max_leverage > 0),
    CONSTRAINT chk_slippage_positive CHECK (slippage_bps >= 0),
    CONSTRAINT chk_alignment_rate_range CHECK (alignment_rate >= 0 AND alignment_rate <= 100),
    
    -- Indexes
    INDEX idx_copy_strategies_user_id (user_id),
    INDEX idx_copy_strategies_status (status),
    INDEX idx_copy_strategies_total_pnl (total_pnl DESC)
);
```

#### Copy Allocations
```sql
CREATE TABLE copy_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID NOT NULL REFERENCES copy_strategies(id) ON DELETE CASCADE,
    trader_id UUID NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
    weight DECIMAL(5, 4) NOT NULL, -- Allocation weight (e.g., 0.6000 for 60%)
    status TEXT DEFAULT 'active', -- active, paused, error
    
    -- Performance tracking
    allocated_pnl DECIMAL(18, 8) DEFAULT 0,
    allocated_fees DECIMAL(18, 8) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_weight_positive CHECK (weight > 0),
    CONSTRAINT chk_weight_max CHECK (weight <= 1),
    UNIQUE(strategy_id, trader_id),
    
    -- Indexes
    INDEX idx_copy_allocations_strategy_id (strategy_id),
    INDEX idx_copy_allocations_trader_id (trader_id)
);

-- Trigger to ensure total allocation weight equals 1.0
CREATE OR REPLACE FUNCTION validate_allocation_weights()
RETURNS TRIGGER AS $$
BEGIN
    IF (
        SELECT COALESCE(SUM(weight), 0) 
        FROM copy_allocations 
        WHERE strategy_id = NEW.strategy_id
    ) > 1.0 THEN
        RAISE EXCEPTION 'Total allocation weight cannot exceed 1.0';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_allocation_weights
    AFTER INSERT OR UPDATE ON copy_allocations
    FOR EACH ROW EXECUTE FUNCTION validate_allocation_weights();
```

#### Orders
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES copy_strategies(id) ON DELETE SET NULL,
    agent_wallet_id UUID REFERENCES agent_wallets(id) ON DELETE SET NULL,
    
    -- Order details
    exchange TEXT NOT NULL DEFAULT 'hyperliquid',
    symbol TEXT NOT NULL,
    side TEXT NOT NULL, -- 'buy', 'sell'
    order_type TEXT NOT NULL, -- 'market', 'limit', 'stop', 'stop_limit'
    
    -- Quantities and prices
    quantity DECIMAL(18, 8) NOT NULL,
    price DECIMAL(18, 8), -- Null for market orders
    filled_quantity DECIMAL(18, 8) DEFAULT 0,
    average_price DECIMAL(18, 8),
    
    -- Order execution
    status TEXT DEFAULT 'pending', -- pending, submitted, partial, filled, cancelled, failed
    exchange_order_id TEXT,
    error_code TEXT,
    error_message TEXT,
    
    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    filled_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Copy trading context
    is_copy_trade BOOLEAN DEFAULT false,
    source_trader_id UUID REFERENCES traders(id),
    source_event_id TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_side_valid CHECK (side IN ('buy', 'sell')),
    CONSTRAINT chk_order_type_valid CHECK (order_type IN ('market', 'limit', 'stop', 'stop_limit')),
    CONSTRAINT chk_filled_quantity_range CHECK (filled_quantity >= 0 AND filled_quantity <= quantity),
    
    -- Indexes
    INDEX idx_orders_user_id (user_id),
    INDEX idx_orders_strategy_id (strategy_id),
    INDEX idx_orders_agent_wallet_id (agent_wallet_id),
    INDEX idx_orders_symbol (symbol),
    INDEX idx_orders_status (status),
    INDEX idx_orders_created_at (created_at DESC),
    INDEX idx_orders_source_trader_id (source_trader_id)
);
```

#### Positions
```sql
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES copy_strategies(id) ON DELETE SET NULL,
    agent_wallet_id UUID REFERENCES agent_wallets(id) ON DELETE SET NULL,
    
    -- Position details
    exchange TEXT NOT NULL DEFAULT 'hyperliquid',
    symbol TEXT NOT NULL,
    side TEXT NOT NULL, -- 'long', 'short'
    
    -- Position quantities
    quantity DECIMAL(18, 8) NOT NULL, -- Current position size (positive for long, negative for short)
    entry_price DECIMAL(18, 8) NOT NULL, -- Weighted average entry price
    mark_price DECIMAL(18, 8),
    
    -- Financial metrics
    unrealized_pnl DECIMAL(18, 8) DEFAULT 0,
    realized_pnl DECIMAL(18, 8) DEFAULT 0,
    leverage DECIMAL(5, 2) DEFAULT 1.0,
    margin_used DECIMAL(18, 8) DEFAULT 0,
    
    -- Timing
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT chk_symbol_side_unique UNIQUE(user_id, agent_wallet_id, symbol),
    CONSTRAINT chk_leverage_positive CHECK (leverage > 0),
    
    -- Indexes
    INDEX idx_positions_user_id (user_id),
    INDEX idx_positions_strategy_id (strategy_id),
    INDEX idx_positions_agent_wallet_id (agent_wallet_id),
    INDEX idx_positions_symbol (symbol),
    INDEX idx_positions_side (side),
    INDEX idx_positions_last_updated_at (last_updated_at DESC)
);

CREATE TRIGGER update_positions_last_updated_at 
    BEFORE UPDATE ON positions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### Fees Ledger
```sql
CREATE TABLE fees_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    strategy_id UUID REFERENCES copy_strategies(id) ON DELETE SET NULL,
    
    -- Fee details
    fee_type TEXT NOT NULL, -- 'trading', 'copy', 'management', 'performance'
    fee_category TEXT NOT NULL, -- 'builder_fee', 'copy_fee', 'vault_management', 'performance_fee'
    
    -- Fee amounts
    fee_bps INTEGER NOT NULL, -- Basis points
    fee_amount DECIMAL(18, 8) NOT NULL,
    fee_currency TEXT NOT NULL DEFAULT 'USD',
    
    -- Calculation context
    notional_amount DECIMAL(18, 8), -- Trade notional for percentage-based fees
    calculation_base TEXT, -- 'trade_volume', 'aum', 'pnl'
    
    -- Transaction details
    transaction_hash TEXT,
    exchange_tx_id TEXT,
    
    -- Timing
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT chk_fee_bps_positive CHECK (fee_bps >= 0),
    CONSTRAINT chk_fee_amount_positive CHECK (fee_amount > 0),
    
    -- Indexes
    INDEX idx_fees_ledger_user_id (user_id),
    INDEX idx_fees_ledger_order_id (order_id),
    INDEX idx_fees_ledger_strategy_id (strategy_id),
    INDEX idx_fees_ledger_fee_type (fee_type),
    INDEX idx_fees_ledger_created_at (created_at DESC)
);
```

#### Audit Logs
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    actor_type TEXT NOT NULL, -- 'user', 'system', 'admin'
    
    -- Action details
    action TEXT NOT NULL, -- 'create_strategy', 'start_copy', 'place_order', etc.
    resource_type TEXT, -- 'strategy', 'order', 'position', 'user'
    resource_id UUID,
    
    -- Action context
    old_values JSONB,
    new_values JSONB,
    request_context JSONB,
    
    -- Result
    status TEXT NOT NULL, -- 'success', 'failure', 'partial'
    error_code TEXT,
    error_message TEXT,
    
    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Indexes
    INDEX idx_audit_logs_actor_id (actor_id),
    INDEX idx_audit_logs_action (action),
    INDEX idx_audit_logs_resource_type (resource_type),
    INDEX idx_audit_logs_created_at (created_at DESC),
    INDEX idx_audit_logs_status (status)
);
```

## ClickHouse Schema (OLAP)

### Market Data Tables

#### Market Ticks (Raw)
```sql
CREATE TABLE market_ticks_raw (
    timestamp DateTime64(9, 'UTC') CODEC(Delta(8), ZSTD(1)),
    symbol LowCardinality(String) CODEC(ZSTD(1)),
    exchange LowCardinality(String) CODEC(ZSTD(1)),
    
    -- Price data
    price Decimal(18, 8) CODEC(Gorilla),
    bid_price Decimal(18, 8) CODEC(Gorilla),
    ask_price Decimal(18, 8) CODEC(Gorilla),
    
    -- Volume data
    volume Decimal(18, 8) CODEC(Gorilla),
    bid_volume Decimal(18, 8) CODEC(Gorilla),
    ask_volume Decimal(18, 8) CODEC(Gorilla),
    
    -- Market metrics
    oi Decimal(18, 8) CODEC(Gorilla), -- Open interest
    funding_rate Decimal(10, 8) CODEC(Gorilla),
    mark_price Decimal(18, 8) CODEC(Gorilla),
    index_price Decimal(18, 8) CODEC(Gorilla),
    
    -- Metadata
    sequence_number UInt64 CODEC(Delta(8), ZSTD(1))
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, exchange, timestamp)
TTL timestamp + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;
```

#### OHLCV Data (Aggregated)
```sql
CREATE TABLE market_ohlcv_1min (
    timestamp DateTime CODEC(Delta(8), ZSTD(1)),
    symbol LowCardinality(String) CODEC(ZSTD(1)),
    exchange LowCardinality(String) CODEC(ZSTD(1)),
    
    -- OHLCV data
    open Decimal(18, 8) CODEC(Gorilla),
    high Decimal(18, 8) CODEC(Gorilla),
    low Decimal(18, 8) CODEC(Gorilla),
    close Decimal(18, 8) CODEC(Gorilla),
    volume Decimal(18, 8) CODEC(Gorilla),
    trade_count UInt32 CODEC(Delta(4), ZSTD(1)),
    
    -- Additional metrics
    vwap Decimal(18, 8) CODEC(Gorilla),
    price_change Decimal(18, 8) CODEC(Gorilla),
    price_change_pct Decimal(8, 4) CODEC(Gorilla),
    
    -- Indexes
    INDEX symbol_idx symbol TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX timestamp_idx timestamp TYPE minmax GRANULARITY 1
)
ENGINE = ReplacingMergeTree(timestamp)
PARTITION BY (exchange, toYYYYMM(timestamp))
ORDER BY (symbol, timestamp)
TTL timestamp + INTERVAL 2 YEAR DELETE;
```

#### Trader Events
```sql
CREATE TABLE trader_events (
    timestamp DateTime64(9, 'UTC') CODEC(Delta(8), ZSTD(1)),
    trader_id LowCardinality(String) CODEC(ZSTD(1)),
    symbol LowCardinality(String) CODEC(ZSTD(1)),
    exchange LowCardinality(String) CODEC(ZSTD(1)),
    
    -- Event details
    action LowCardinality(String) CODEC(ZSTD(1)), -- open, close, add, reduce, liquidation
    side LowCardinality(String) CODEC(ZSTD(1)), -- long, short
    
    -- Position changes
    quantity Decimal(18, 8) CODEC(Gorilla),
    price Decimal(18, 8) CODEC(Gorilla),
    notional_value Decimal(18, 8) CODEC(Gorilla),
    
    -- Position state
    prev_exposure Decimal(18, 8) CODEC(Gorilla),
    new_exposure Decimal(18, 8) CODEC(Gorilla),
    exposure_change Decimal(18, 8) CODEC(Gorilla),
    
    -- Metadata
    order_id String CODEC(ZSTD(1)),
    trade_id String CODEC(ZSTD(1)),
    leverage Decimal(5, 2) CODEC(Gorilla),
    
    -- Deduplication
    event_hash String CODEC(ZSTD(1))
)
ENGINE = ReplacingMergeTree(timestamp, event_hash)
PARTITION BY toYYYYMM(timestamp)
ORDER BY (trader_id, symbol, timestamp)
TTL timestamp + INTERVAL 30 DAY DELETE;
```

#### Trader KPIs (Daily)
```sql
CREATE TABLE trader_kpis_day (
    date Date CODEC(Delta(1), ZSTD(1)),
    trader_id LowCardinality(String) CODEC(ZSTD(1)),
    symbol LowCardinality(String) CODEC(ZSTD(1)),
    
    -- Performance metrics
    pnl Decimal(18, 8) CODEC(Gorilla),
    return_pct Decimal(8, 4) CODEC(Gorilla),
    win_rate Decimal(5, 4) CODEC(Gorilla),
    sharpe_ratio Decimal(8, 4) CODEC(Gorilla),
    max_drawdown Decimal(8, 4) CODEC(Gorilla),
    
    -- Trading activity
    trade_count UInt32 CODEC(Delta(4), ZSTD(1)),
    volume Decimal(18, 8) CODEC(Gorilla),
    turnover Decimal(18, 8) CODEC(Gorilla),
    avg_hold_time_seconds UInt32 CODEC(Delta(4), ZSTD(1)),
    
    -- Risk metrics
    leverage_avg Decimal(5, 2) CODEC(Gorilla),
    leverage_max Decimal(5, 2) CODEC(Gorilla),
    var_daily_95 Decimal(18, 8) CODEC(Gorilla),
    
    -- Indexes
    INDEX trader_date_idx (trader_id, date) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX return_idx return_pct TYPE minmax GRANULARITY 1
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (trader_id, symbol, date)
TTL date + INTERVAL 2 YEAR DELETE;
```

#### Liquidation Heatmap Bins
```sql
CREATE TABLE liq_heatmap_bins (
    timestamp DateTime64(3, 'UTC') CODEC(Delta(8), ZSTD(1)),
    symbol LowCardinality(String) CODEC(ZSTD(1)),
    exchange LowCardinality(String) CODEC(ZSTD(1)),
    
    -- Heatmap dimensions
    window_type LowCardinality(String) CODEC(ZSTD(1)), -- 1h, 4h, 12h, 24h
    price_bin_center Decimal(18, 8) CODEC(Gorilla),
    price_bin_width Decimal(18, 8) CODEC(Gorilla),
    
    -- Liquidation estimates
    liq_volume Long Decimal(18, 8) CODEC(Gorilla),
    liq_count UInt32 CODEC(Delta(4), ZSTD(1)),
    liq_notional Decimal(18, 8) CODEC(Gorilla),
    
    -- Calculation metadata
    method_version UInt16 CODEC(ZSTD(1)),
    confidence_score Decimal(5, 4) CODEC(Gorilla),
    data_sources Array(String) CODEC(ZSTD(1)),
    
    -- Indexes
    INDEX symbol_window_idx (symbol, window_type) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX price_idx price_bin_center TYPE minmax GRANULARITY 1
)
ENGINE = AggregatingMergeTree()
PARTITION BY (exchange, toYYYYMM(timestamp))
ORDER BY (symbol, window_type, price_bin_center, timestamp)
TTL timestamp + INTERVAL 7 DAY DELETE;
```

#### Copy Trade Events
```sql
CREATE TABLE copy_trade_events (
    timestamp DateTime64(9, 'UTC') CODEC(Delta(8), ZSTD(1)),
    strategy_id LowCardinality(String) CODEC(ZSTD(1)),
    user_id LowCardinality(String) CODEC(ZSTD(1)),
    source_trader_id LowCardinality(String) CODEC(ZSTD(1)),
    
    -- Event details
    event_type LowCardinality(String) CODEC(ZSTD(1)), -- signal_received, order_placed, order_filled, alignment_check
    symbol LowCardinality(String) CODEC(ZSTD(1)),
    
    -- Performance metrics
    latency_ms UInt32 CODEC(Delta(4), ZSTD(1)),
    alignment_rate Decimal(5, 2) CODEC(Gorilla),
    slippage_bps Integer CODEC(ZSTD(1)),
    
    -- Order details
    order_id String CODEC(ZSTD(1)),
    quantity Decimal(18, 8) CODEC(Gorilla),
    price Decimal(18, 8) CODEC(Gorilla),
    side LowCardinality(String) CODEC(ZSTD(1)),
    
    -- Result
    status LowCardinality(String) CODEC(ZSTD(1)), -- success, failed, partial
    error_code String CODEC(ZSTD(1)),
    retry_count UInt8 CODEC(ZSTD(1)),
    
    -- Metadata
    metadata JSON CODEC(ZSTD(1))
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (strategy_id, timestamp)
TTL timestamp + INTERVAL 30 DAY DELETE;
```

## Materialized Views (ClickHouse)

### Real-time OHLCV Generation
```sql
CREATE MATERIALIZED VIEW mv_ohlcv_1min TO market_ohlcv_1min AS
SELECT
    toStartOfMinute(timestamp) AS timestamp,
    symbol,
    exchange,
    anyState(price) AS open,
    maxState(price) AS high,
    minState(price) AS low,
    anyState(price) AS close,
    sumState(volume) AS volume,
    countState() AS trade_count,
    avgState(price * volume) / avgState(volume) AS vwap,
    -- Price change calculation (requires previous close reference)
    0 AS price_change,
    0 AS price_change_pct
FROM market_ticks_raw
GROUP BY symbol, exchange, toStartOfMinute(timestamp);
```

### Trader KPI Calculation
```sql
CREATE MATERIALIZED VIEW mv_trader_kpis_day TO trader_kpis_day AS
SELECT
    toDate(timestamp) AS date,
    trader_id,
    symbol,
    -- Daily PnL calculation
    sumIf(exposure_change * price, action = 'close') AS pnl,
    
    -- Trading activity
    count() AS trade_count,
    sum(abs(notional_value)) AS volume,
    sum(abs(exposure_change)) AS turnover,
    
    -- Win rate (simplified)
    countIf(action = 'close' AND exposure_change > 0) AS winning_trades,
    
    -- Risk metrics
    avg(leverage) AS leverage_avg,
    max(leverage) AS leverage_max
    
FROM trader_events
GROUP BY 
    trader_id, 
    symbol, 
    toDate(timestamp);
```

### Real-time Heatmap Updates
```sql
CREATE MATERIALIZED VIEW mv_liq_heatmap_realtime TO liq_heatmap_bins AS
SELECT
    now() AS timestamp,
    symbol,
    exchange,
    '1h' AS window_type,
    floor(price / 10) * 10 AS price_bin_center, -- $10 bins for BTC
    10 AS price_bin_width,
    
    -- Liquidation volume estimation (simplified)
    sum(abs(quantity)) AS liq_volume,
    count() AS liq_count,
    sum(abs(quantity * price)) AS liq_notional,
    
    1 AS method_version,
    0.8 AS confidence_score,
    ['oi', 'funding_rate', 'price'] AS data_sources
    
FROM market_ticks_raw
WHERE oi > 0 -- Only consider symbols with open interest
GROUP BY 
    symbol, 
    exchange, 
    floor(price / 10) * 10
HAVING liq_volume > 0;
```

## Data Validation Rules

### PostgreSQL Constraints
1. **Foreign Key Integrity**: All relationships maintain referential integrity
2. **Check Constraints**: Business rules enforced at database level
3. **Unique Constraints**: Prevent duplicate data where appropriate
4. **Trigger Validations**: Complex business logic enforced via triggers

### ClickHouse Data Quality
1. **Deduplication**: Using ReplacingMergeTree with event hashes
2. **Data Type Optimization**: Specialized codecs for different data types
3. **TTL Management**: Automatic data lifecycle management
4. **Partitioning Strategy**: Optimized for time-series query patterns

## Performance Considerations

### Indexing Strategy
- **PostgreSQL**: B-tree indexes for equality and range queries, partial indexes for common filters
- **ClickHouse**: Order by keys optimized for time-series queries, bloom filter indexes for high-cardinality columns

### Query Optimization
- **Partition Pruning**: Time-based partitions ensure efficient historical queries
- **Materialized Views**: Pre-computed aggregations for real-time analytics
- **Projection Pushdown**: Minimize data transfer with column pruning

### Scaling Patterns
- **Horizontal Scaling**: Both databases support clustering for high availability
- **Read Replicas**: Analytical queries can be offloaded to read replicas
- **Caching Layer**: Redis for frequently accessed hot data

## Security Considerations

### Data Encryption
- **At Rest**: Database encryption enabled
- **In Transit**: TLS/SSL for all connections
- **Column Level**: Sensitive data encrypted at column level

### Access Control
- **Role-Based Access**: Different roles for different access patterns
- **Row Level Security**: Users can only access their own data
- **Audit Trail**: Comprehensive logging of all data access

### Privacy Protection
- **Data Anonymization**: Trader identities anonymized where required
- **PII Protection**: Personal information handled according to regulations
- **Data Retention**: Policies compliant with financial regulations

This data model provides a comprehensive foundation for the HyperDash platform, supporting both real-time trading operations and sophisticated analytics while maintaining data integrity and performance requirements.