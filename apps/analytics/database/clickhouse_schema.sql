-- HyperDash Platform Analytics Schema
-- ClickHouse Configuration for Time-Series Analytics

-- ============================================================================
-- MARKET DATA
-- ============================================================================

-- Real-time price data for all tokens
CREATE TABLE market_data (
    timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    token_symbol String CODEC(ZSTD),
    token_address String CODEC(ZSTD),
    price Decimal(20, 8) CODEC(ZSTD),
    volume_24h Decimal(20, 8) CODEC(ZSTD),
    market_cap Decimal(30, 8) CODEC(ZSTD),
    price_change_24h Decimal(10, 4) CODEC(ZSTD),
    liquidity Decimal(20, 8) CODEC(ZSTD),
    supply Decimal(30, 8) CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (token_symbol, timestamp)
TTL timestamp + INTERVAL 30 DAY DELETE;

-- ============================================================================
-- WHALE ACTIVITY
-- ============================================================================

-- Whale wallet balances and movements
CREATE TABLE whale_balances (
    timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    trader_address String CODEC(ZSTD),
    token_symbol String CODEC(ZSTD),
    token_address String CODEC(ZSTD),
    balance Decimal(30, 8) CODEC(ZSTD),
    usd_value Decimal(30, 8) CODEC(ZSTD),
    portfolio_percentage Decimal(5, 4) CODEC(ZSTD),
    change_24h Decimal(20, 8) CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (trader_address, token_symbol, timestamp)
TTL timestamp + INTERVAL 90 DAY DELETE;

-- Whale transactions and trades
CREATE TABLE whale_transactions (
    timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    transaction_hash String CODEC(ZSTD),
    block_number UInt64 CODEC(ZSTD),
    trader_address String CODEC(ZSTD),
    token_symbol String CODEC(ZSTD),
    token_address String CODEC(ZSTD),
    trade_type Enum('buy' = 1, 'sell' = 2, 'transfer' = 3) CODEC(ZSTD),
    amount Decimal(30, 8) CODEC(ZSTD),
    price Decimal(20, 8) CODEC(ZSTD),
    usd_value Decimal(30, 8) CODEC(ZSTD),
    fee Decimal(20, 8) CODEC(ZSTD),
    gas_used UInt64 CODEC(ZSTD),
    gas_price Decimal(20, 8) CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (trader_address, timestamp, trade_type)
TTL timestamp + INTERVAL 180 DAY DELETE;

-- ============================================================================
-- POSITION TRACKING
-- ============================================================================

-- Real-time position data for all traders
CREATE TABLE trader_positions (
    timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    trader_address String CODEC(ZSTD),
    user_id UUID CODEC(ZSTD),
    token_symbol String CODEC(ZSTD),
    token_address String CODEC(ZSTD),
    side Enum('long' = 1, 'short' = 2) CODEC(ZSTD),
    size Decimal(30, 8) CODEC(ZSTD),
    entry_price Decimal(20, 8) CODEC(ZSTD),
    current_price Decimal(20, 8) CODEC(ZSTD),
    unrealized_pnl Decimal(30, 8) CODEC(ZSTD),
    realized_pnl Decimal(30, 8) CODEC(ZSTD),
    leverage Decimal(5, 2) CODEC(ZSTD),
    liquidation_price Decimal(20, 8) CODEC(ZSTD),
    funding_rate Decimal(10, 8) CODEC(ZSTD),
    is_copy_trade UInt8 CODEC(ZSTD),
    copy_relationship_id UUID CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (trader_address, token_symbol, timestamp)
TTL timestamp + INTERVAL 30 DAY DELETE;

-- Position history for analytics
CREATE TABLE position_history (
    timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    position_id UUID CODEC(ZSTD),
    trader_address String CODEC(ZSTD),
    user_id UUID CODEC(ZSTD),
    token_symbol String CODEC(ZSTD),
    event_type Enum('open' = 1, 'close' = 2, 'increase' = 3, 'decrease' = 4, 'liquidation' = 5) CODEC(ZSTD),
    size_before Decimal(30, 8) CODEC(ZSTD),
    size_after Decimal(30, 8) CODEC(ZSTD),
    price Decimal(20, 8) CODEC(ZSTD),
    pnl_impact Decimal(30, 8) CODEC(ZSTD),
    is_copy_trade UInt8 CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (position_id, timestamp)
TTL timestamp + INTERVAL 365 DAY DELETE;

-- ============================================================================
-- COPY TRADING ANALYTICS
-- ============================================================================

-- Copy trading performance metrics
CREATE TABLE copy_trading_metrics (
    timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    relationship_id UUID CODEC(ZSTD),
    follower_id UUID CODEC(ZSTD),
    trader_address String CODEC(ZSTD),
    total_allocation Decimal(30, 8) CODEC(ZSTD),
    current_pnl Decimal(30, 8) CODEC(ZSTD),
    daily_pnl Decimal(30, 8) CODEC(ZSTD),
    win_rate Decimal(5, 4) CODEC(ZSTD),
    total_trades UInt32 CODEC(ZSTD),
    successful_copies UInt32 CODEC(ZSTD),
    failed_copies UInt32 CODEC(ZSTD),
    average_copy_delay Decimal(10, 3) CODEC(ZSTD), -- in seconds
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (relationship_id, timestamp)
TTL timestamp + INTERVAL 180 DAY DELETE;

-- Copy trading event log
CREATE TABLE copy_trading_events (
    timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    event_id UUID CODEC(ZSTD),
    relationship_id UUID CODEC(ZSTD),
    original_trade_id UUID CODEC(ZSTD),
    copied_trade_id UUID CODEC(ZSTD),
    event_type Enum('copy_started' = 1, 'copy_completed' = 2, 'copy_failed' = 3, 'rebalance' = 4, 'stop_loss' = 5) CODEC(ZSTD),
    trader_address String CODEC(ZSTD),
    token_symbol String CODEC(ZSTD),
    original_amount Decimal(30, 8) CODEC(ZSTD),
    copied_amount Decimal(30, 8) CODEC(ZSTD),
    price_impact Decimal(10, 4) CODEC(ZSTD),
    slippage Decimal(10, 4) CODEC(ZSTD),
    execution_time_ms UInt32 CODEC(ZSTD),
    error_message String CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (relationship_id, event_type, timestamp)
TTL timestamp + INTERVAL 90 DAY DELETE;

-- ============================================================================
-- PERFORMANCE ANALYTICS
-- ============================================================================

-- Trader performance metrics (updated hourly)
CREATE TABLE trader_performance_hourly (
    timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    trader_address String CODEC(ZSTD),
    hour DateTime64(3, 'UTC') CODEC(Delta),
    total_pnl Decimal(30, 8) CODEC(ZSTD),
    win_rate Decimal(5, 4) CODEC(ZSTD),
    total_trades UInt32 CODEC(ZSTD),
    winning_trades UInt32 CODEC(ZSTD),
    losing_trades UInt32 CODEC(ZSTD),
    average_trade_size Decimal(30, 8) CODEC(ZSTD),
    max_drawdown Decimal(10, 4) CODEC(ZSTD),
    sharpe_ratio Decimal(10, 4) CODEC(ZSTD),
    sortino_ratio Decimal(10, 4) CODEC(ZSTD),
    volatility Decimal(10, 4) CODEC(ZSTD),
    followers_count UInt32 CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (trader_address, hour)
TTL timestamp + INTERVAL 730 DAY DELETE;

-- Token performance metrics
CREATE TABLE token_performance_hourly (
    timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    token_symbol String CODEC(ZSTD),
    hour DateTime64(3, 'UTC') CODEC(Delta),
    open_price Decimal(20, 8) CODEC(ZSTD),
    high_price Decimal(20, 8) CODEC(ZSTD),
    low_price Decimal(20, 8) CODEC(ZSTD),
    close_price Decimal(20, 8) CODEC(ZSTD),
    volume Decimal(30, 8) CODEC(ZSTD),
    trades_count UInt32 CODEC(ZSTD),
    unique_traders UInt32 CODEC(ZSTD),
    whale_trades UInt32 CODEC(ZSTD),
    price_volatility Decimal(10, 4) CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (token_symbol, hour)
TTL timestamp + INTERVAL 365 DAY DELETE;

-- ============================================================================
-- USER ACTIVITY AND BEHAVIOR
-- ============================================================================

-- User activity tracking
CREATE TABLE user_activity (
    timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    user_id UUID CODEC(ZSTD),
    session_id String CODEC(ZSTD),
    event_type Enum('login' = 1, 'logout' = 2, 'page_view' = 3, 'trade' = 4, 'copy_start' = 5, 'copy_stop' = 6, 'alert_create' = 7) CODEC(ZSTD),
    resource_type String CODEC(ZSTD),
    resource_id String CODEC(ZSTD),
    ip_address String CODEC(ZSTD),
    user_agent String CODEC(ZSTD),
    duration_ms UInt32 CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (user_id, timestamp, event_type)
TTL timestamp + INTERVAL 90 DAY DELETE;

-- Feature usage analytics
CREATE TABLE feature_usage (
    timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    user_id UUID CODEC(ZSTD),
    feature_name String CODEC(ZSTD),
    action String CODEC(ZSTD),
    parameters String CODEC(ZSTD),
    result String CODEC(ZSTD),
    performance_ms UInt32 CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (user_id, feature_name, timestamp)
TTL timestamp + INTERVAL 180 DAY DELETE;

-- ============================================================================
-- SYSTEM METRICS
-- ============================================================================

-- API performance metrics
CREATE TABLE api_metrics (
    timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    endpoint String CODEC(ZSTD),
    method String CODEC(ZSTD),
    status_code UInt16 CODEC(ZSTD),
    response_time_ms UInt32 CODEC(ZSTD),
    request_size_bytes UInt32 CODEC(ZSTD),
    response_size_bytes UInt32 CODEC(ZSTD),
    user_id UUID CODEC(ZSTD),
    ip_address String CODEC(ZSTD),
    error_message String CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (endpoint, method, timestamp)
TTL timestamp + INTERVAL 30 DAY DELETE;

-- System health metrics
CREATE TABLE system_metrics (
    timestamp DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    metric_name String CODEC(ZSTD),
    metric_value Decimal(20, 8) CODEC(ZSTD),
    metric_unit String CODEC(ZSTD),
    tags Map(String, String) CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (metric_name, timestamp)
TTL timestamp + INTERVAL 30 DAY DELETE;

-- ============================================================================
-- MATERIALIZED VIEWS FOR AGGREGATIONS
-- ============================================================================

-- Real-time whale ranking
CREATE MATERIALIZED VIEW whale_ranking_mv
ENGINE = SummingMergeTree()
ORDER BY (trader_address)
AS SELECT
    toStartOfHour(timestamp) as hour,
    trader_address,
    sum(usd_value) as total_usd_value,
    count() as transaction_count,
    uniq(token_symbol) as unique_tokens
FROM whale_transactions
WHERE timestamp >= now() - INTERVAL 1 DAY
GROUP BY trader_address, hour;

-- Top tokens by volume
CREATE MATERIALIZED VIEW top_tokens_mv
ENGINE = SummingMergeTree()
ORDER BY (token_symbol)
AS SELECT
    toStartOfHour(timestamp) as hour,
    token_symbol,
    sum(usd_value) as total_volume,
    count() as trade_count,
    uniq(trader_address) as unique_traders
FROM whale_transactions
WHERE timestamp >= now() - INTERVAL 1 DAY
GROUP BY token_symbol, hour;

-- Copy trading performance summary
CREATE MATERIALIZED VIEW copy_performance_summary_mv
ENGINE = SummingMergeTree()
ORDER BY (relationship_id)
AS SELECT
    toStartOfDay(timestamp) as date,
    relationship_id,
    sum(daily_pnl) as cumulative_pnl,
    avg(win_rate) as avg_win_rate,
    sum(total_trades) as total_trades,
    sum(successful_copies) as successful_copies
FROM copy_trading_metrics
GROUP BY relationship_id, date;

-- ============================================================================
-- AGGREGATION TABLES FOR DASHBOARDS
-- ============================================================================

-- Daily market summary (pre-aggregated for fast queries)
CREATE TABLE market_summary_daily (
    date Date CODEC(Delta),
    token_symbol String CODEC(ZSTD),
    open_price Decimal(20, 8) CODEC(ZSTD),
    high_price Decimal(20, 8) CODEC(ZSTD),
    low_price Decimal(20, 8) CODEC(ZSTD),
    close_price Decimal(20, 8) CODEC(ZSTD),
    volume_24h Decimal(30, 8) CODEC(ZSTD),
    trade_count UInt32 CODEC(ZSTD),
    unique_traders UInt32 CODEC(ZSTD),
    price_change_percent Decimal(10, 4) CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = ReplacingMergeTree()
ORDER BY (date, token_symbol)
TTL date + INTERVAL 2 YEAR DELETE;

-- Weekly trader leaderboard
CREATE TABLE trader_leaderboard_weekly (
    week Date CODEC(Delta),
    trader_address String CODEC(ZSTD),
    rank UInt32 CODEC(ZSTD),
    total_pnl Decimal(30, 8) CODEC(ZSTD),
    win_rate Decimal(5, 4) CODEC(ZSTD),
    trade_count UInt32 CODEC(ZSTD),
    followers UInt32 CODEC(ZSTD),
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = ReplacingMergeTree()
ORDER BY (week, rank)
TTL week + INTERVAL 1 YEAR DELETE;
