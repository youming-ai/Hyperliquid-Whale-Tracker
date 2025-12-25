-- HyperDash Platform Analytics Schema
-- ClickHouse Configuration for Time-Series Market Data

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS hyperdash_analytics;

USE hyperdash_analytics;

-- ============================================================================
-- MARKET DATA - TIME SERIES TABLES
-- ============================================================================

-- Ohlcv data for minute resolution
CREATE TABLE IF NOT EXISTS ohlcv_1m (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    token String,
    open Decimal(18, 8),
    high Decimal(18, 8),
    low Decimal(18, 8),
    close Decimal(18, 8),
    volume Decimal(24, 8),
    trades_count UInt32,
    buy_volume Decimal(24, 8),
    sell_volume Decimal(24, 8),
    quote_volume Decimal(24, 8),
    weighted_avg_price Decimal(18, 8),
    start_time DateTime64(3),
    end_time DateTime64(3),
    exchange String DEFAULT 'hyperliquid',
    SYMBOL CODEC(Delta, ZSTD)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (token, timestamp)
SETTINGS index_granularity = 8192;

-- Ohlcv data for hourly resolution
CREATE TABLE IF NOT EXISTS ohlcv_1h (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    token String,
    open Decimal(18, 8),
    high Decimal(18, 8),
    low Decimal(18, 8),
    close Decimal(18, 8),
    volume Decimal(24, 8),
    trades_count UInt32,
    buy_volume Decimal(24, 8),
    sell_volume Decimal(24, 8),
    quote_volume Decimal(24, 8),
    weighted_avg_price Decimal(18, 8),
    start_time DateTime64(3),
    end_time DateTime64(3),
    exchange String DEFAULT 'hyperliquid'
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (token, timestamp)
SETTINGS index_granularity = 8192;

-- Ohlcv data for daily resolution
CREATE TABLE IF NOT EXISTS ohlcv_1d (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    token String,
    open Decimal(18, 8),
    high Decimal(18, 8),
    low Decimal(18, 8),
    close Decimal(18, 8),
    volume Decimal(24, 8),
    trades_count UInt32,
    buy_volume Decimal(24, 8),
    sell_volume Decimal(24, 8),
    quote_volume Decimal(24, 8),
    weighted_avg_price Decimal(18, 8),
    start_time DateTime64(3),
    end_time DateTime64(3),
    exchange String DEFAULT 'hyperliquid'
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (token, timestamp)
SETTINGS index_granularity = 8192;

-- ============================================================================
-- TRADES - TICK DATA
-- ============================================================================

-- Individual trades
CREATE TABLE IF NOT EXISTS trades_tick (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    transaction_id String,
    token String,
    side Enum8('buy' = 1, 'sell' = 2),
    price Decimal(18, 8),
    amount Decimal(24, 8),
    total Decimal(24, 8),
    fee Decimal(18, 8),
    trader_address String,
    block_number UInt64,
    exchange String DEFAULT 'hyperliquid',
    is_large_cap Boolean DEFAULT false
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (token, timestamp)
SETTINGS index_granularity = 16384;

-- ============================================================================
-- LIQUIDITY DATA
-- ============================================================================

-- Order book snapshots
CREATE TABLE IF NOT EXISTS orderbook_snapshots (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    token String,
    exchange String DEFAULT 'hyperliquid',
    bids Array(Tuple(Decimal(18, 8), Decimal(24, 8))),
    asks Array(Tuple(Decimal(18, 8), Decimal(24, 8))),
    best_bid Decimal(18, 8),
    best_ask Decimal(18, 8),
    spread Decimal(18, 8),
    bid_volume Decimal(24, 8),
    ask_volume Decimal(24, 8),
    mid_price Decimal(18, 8),
    bid_depth_1_percent Decimal(24, 8),
    ask_depth_1_percent Decimal(24, 8),
    update_id UInt64
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (token, timestamp)
SETTINGS index_granularity = 8192;

-- ============================================================================
-- TRADER ACTIVITY ANALYTICS
-- ============================================================================

-- Trader position changes
CREATE TABLE IF NOT EXISTS trader_positions (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    trader_address String,
    token String,
    position_size Decimal(24, 8),
    entry_price Decimal(18, 8),
    mark_price Decimal(18, 8),
    unrealized_pnl Decimal(24, 8),
    leverage UInt16,
    liquidation_price Decimal(18, 8),
    funding_rate Decimal(18, 8),
    long_liquidation_price Decimal(18, 8),
    short_liquidation_price Decimal(18, 8),
    is_whale Boolean DEFAULT false,
    portfolio_value Decimal(24, 8)
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (trader_address, token, timestamp)
SETTINGS index_granularity = 8192;

-- Trader trade summary by hour
CREATE TABLE IF NOT EXISTS trader_trade_summary_hourly (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    trader_address String,
    token String,
    trades_count UInt32,
    buy_volume Decimal(24, 8),
    sell_volume Decimal(24, 8),
    avg_buy_price Decimal(18, 8),
    avg_sell_price Decimal(18, 8),
    realized_pnl Decimal(24, 8),
    fees_paid Decimal(18, 8),
    win_trades UInt16,
    loss_trades UInt16,
    largest_win Decimal(24, 8),
    largest_loss Decimal(24, 8),
    is_whale Boolean DEFAULT false,
    distinct_tokens UInt16,
    unique_counterparties UInt32
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (trader_address, token, timestamp)
SETTINGS index_granularity = 8192;

-- ============================================================================
-- FLOW ANALYTICS
-- ============================================================================

-- Token inflow/outflow
CREATE TABLE IF NOT EXISTS token_flows (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    token String,
    inflow Decimal(24, 8),
    outflow Decimal(24, 8),
    net_flow Decimal(24, 8),
    whale_inflow Decimal(24, 8),
    whale_outflow Decimal(24, 8),
    whale_net_flow Decimal(24, 8),
    large_transactions_count UInt32,
    unique_wallets UInt32,
    price_change_1h Decimal(10, 4),
    price_change_24h Decimal(10, 4),
    volume_24h Decimal(24, 8),
    volume_change_24h Decimal(10, 4)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (token, timestamp)
SETTINGS index_granularity = 8192;

-- Whale wallet movements
CREATE TABLE IF NOT EXISTS whale_movements (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    trader_address String,
    token String,
    action Enum8('buy' = 1, 'sell' = 2, 'transfer_in' = 3, 'transfer_out' = 4),
    amount Decimal(24, 8),
    usd_value Decimal(24, 8),
    price_impact Decimal(10, 4),
    balance_before Decimal(24, 8),
    balance_after Decimal(24, 8),
    transaction_id String,
    confidence_score UInt8,
    is_suspected_wash Boolean DEFAULT false
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (trader_address, timestamp)
SETTINGS index_granularity = 16384;

-- ============================================================================
-- COPY TRADING ANALYTICS
-- ============================================================================

-- Copy trade performance
CREATE TABLE IF NOT EXISTS copy_trade_performance (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    follower_id String,
    trader_id String,
    relationship_id String,
    token String,
    copy_action Enum8('open' = 1, 'close' = 2, 'adjust' = 3),
    copy_size Decimal(24, 8),
    original_size Decimal(24, 8),
    copy_price Decimal(18, 8),
    original_price Decimal(18, 8),
    slippage Decimal(10, 4),
    realization_lag_ms UInt32,
    pnl_contribution Decimal(24, 8),
    allocation_percentage Decimal(5, 2),
    strategy_type String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (relationship_id, token, timestamp)
SETTINGS index_granularity = 8192;

-- Copy trading metrics
CREATE TABLE IF NOT EXISTS copy_trading_metrics_daily (
    date Date,
    trader_id String,
    followers_count UInt32,
    total_copy_volume Decimal(24, 8),
    avg_copy_size Decimal(24, 8),
    copy_performance Decimal(10, 4),
    slippage_avg Decimal(10, 4),
    win_rate Decimal(5, 4),
    roi_7d Decimal(10, 4),
    roi_30d Decimal(10, 4),
    ranking_position UInt32,
    social_score Decimal(5, 4),
    volume_percentile UInt8
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (trader_id, date)
SETTINGS index_granularity = 8192;

-- ============================================================================
-- AGGREGATED VIEWS AND MATERIALIZED VIEWS
-- ============================================================================

-- Materialized view for hourly OHLCV aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS ohlcv_1h_mv TO ohlcv_1h AS
SELECT
    toStartOfHour(timestamp) as timestamp,
    token,
    first_value(open) OVER (PARTITION BY token, toStartOfHour(timestamp) ORDER BY timestamp ASC) as open,
    max(high) as high,
    min(low) as low,
    last_value(close) OVER (PARTITION BY token, toStartOfHour(timestamp) ORDER BY timestamp ASC) as close,
    sum(volume) as volume,
    sum(trades_count) as trades_count,
    sum(buy_volume) as buy_volume,
    sum(sell_volume) as sell_volume,
    sum(quote_volume) as quote_volume,
    avg(weighted_avg_price) as weighted_avg_price,
    min(start_time) as start_time,
    max(end_time) as end_time,
    any(exchange) as exchange
FROM ohlcv_1m
GROUP BY token, toStartOfHour(timestamp);

-- Materialized view for daily OHLCV aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS ohlcv_1d_mv TO ohlcv_1d AS
SELECT
    toDate(timestamp) as timestamp,
    token,
    first_value(open) OVER (PARTITION BY token, toDate(timestamp) ORDER BY timestamp ASC) as open,
    max(high) as high,
    min(low) as low,
    last_value(close) OVER (PARTITION BY token, toDate(timestamp) ORDER BY timestamp ASC) as close,
    sum(volume) as volume,
    sum(trades_count) as trades_count,
    sum(buy_volume) as buy_volume,
    sum(sell_volume) as sell_volume,
    sum(quote_volume) as quote_volume,
    avg(weighted_avg_price) as weighted_avg_price,
    min(start_time) as start_time,
    max(end_time) as end_time,
    any(exchange) as exchange
FROM ohlcv_1h
GROUP BY token, toDate(timestamp);

-- ============================================================================
-- DICTIONARY TABLES
-- ============================================================================

-- Token metadata dictionary
CREATE TABLE IF NOT EXISTS tokens_metadata (
    token String,
    name String,
    symbol String,
    decimals UInt8,
    address String,
    category String,
    is_active UInt8 DEFAULT 1,
    created_at DateTime64(3),
    market_cap Decimal(24, 8),
    volume_24h Decimal(24, 8),
    price_usd Decimal(18, 8),
    price_change_24h Decimal(10, 4),
    social_links Array(String),
    tags Array(String),
    description String
) ENGINE = MergeTree()
ORDER BY token
SETTINGS index_granularity = 8192;

-- ============================================================================
-- ANALYTICS FUNCTIONS
-- ============================================================================

-- Function to calculate VWAP
CREATE OR REPLACE FUNCTION calculate_vwap(
    start_time DateTime64(3),
    end_time DateTime64(3),
    token String
) AS (
    SELECT
        sum(volume * price) / sum(volume) as vwap
    FROM ohlcv_1m
    WHERE timestamp >= start_time
      AND timestamp < end_time
      AND token = token
      AND volume > 0
);

-- Function to detect whale movements
CREATE OR REPLACE FUNCTION detect_whale_movements(
    lookback_hours UInt16,
    volume_threshold UInt64
) AS (
    SELECT
        token,
        trader_address,
        sum(amount) as total_volume,
        count() as trade_count,
        avg(amount) as avg_trade_size,
        percentile(0.95)(amount) as p95_trade_size
    FROM trades_tick
    WHERE timestamp >= now() - INTERVAL lookback_hours HOUR
      AND amount >= volume_threshold
    GROUP BY token, trader_address
    HAVING sum(amount) >= volume_threshold * 10
    ORDER BY total_volume DESC
);

-- Function to get top movers by percentage change
CREATE OR REPLACE FUNCTION get_top_movers(
    timeframe String DEFAULT '24h',
    min_volume UInt64 DEFAULT 1000000
) AS (
    SELECT
        token,
        close,
        open,
        (close - open) / open * 100 as percent_change,
        volume,
        timestamp
    FROM ohlcv_1h
    WHERE timestamp >= now() - CASE
        WHEN timeframe = '1h' THEN INTERVAL 1 HOUR
        WHEN timeframe = '24h' THEN INTERVAL 24 HOUR
        WHEN timeframe = '7d' THEN INTERVAL 7 DAY
        ELSE INTERVAL 24 HOUR
    END
    AND volume >= min_volume
    ORDER BY abs(percent_change) DESC
    LIMIT 20
);

-- ============================================================================
-- RETENTION POLICIES
-- ============================================================================

-- Set retention policies
ALTER TABLE ohlcv_1m MODIFY TTL timestamp + toIntervalMonth(3);
ALTER TABLE ohlcv_1h MODIFY TTL timestamp + toIntervalYear(1);
ALTER TABLE ohlcv_1d MODIFY TTL timestamp + toIntervalYear(5);
ALTER TABLE trades_tick MODIFY TTL timestamp + toIntervalMonth(1);
ALTER TABLE trader_positions MODIFY TTL timestamp + toIntervalMonth(3);
ALTER TABLE trader_trade_summary_hourly MODIFY TTL timestamp + toIntervalYear(1);
ALTER TABLE whale_movements MODIFY TTL timestamp + toIntervalMonth(6);
ALTER TABLE copy_trade_performance MODIFY TTL timestamp + toIntervalYear(1);
