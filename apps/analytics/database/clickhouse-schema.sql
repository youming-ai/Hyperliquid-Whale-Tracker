-- HyperDash Platform ClickHouse Schema
-- Time-series Analytics Data for Market Intelligence

-- ============================================================================
-- MARKET DATA
-- ============================================================================

-- Real-time price data with high frequency
CREATE TABLE market_data (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    token_symbol String CODEC(ZSTD),
    token_address String CODEC(ZSTD),
    price Decimal(20, 8) CODEC(ZSTD),
    volume Decimal(20, 8) CODEC(ZSTD),
    bid_price Decimal(20, 8) CODEC(ZSTD),
    ask_price Decimal(20, 8) CODEC(ZSTD),
    bid_size Decimal(20, 8) CODEC(ZSTD),
    ask_size Decimal(20, 8) CODEC(ZSTD),
    exchange String CODEC(ZSTD),
    source String CODEC(ZSTD),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (token_symbol, timestamp)
TTL timestamp + toIntervalDay(90);

-- OHLCV candlestick data
CREATE TABLE ohlcv_data (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    token_symbol String CODEC(ZSTD),
    interval String CODEC(ZSTD), -- '1m', '5m', '15m', '1h', '4h', '1d'
    open_price Decimal(20, 8) CODEC(ZSTD),
    high_price Decimal(20, 8) CODEC(ZSTD),
    low_price Decimal(20, 8) CODEC(ZSTD),
    close_price Decimal(20, 8) CODEC(ZSTD),
    volume Decimal(20, 8) CODEC(ZSTD),
    trades_count UInt32 CODEC(ZSTD),
    exchange String CODEC(ZSTD),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY (token_symbol, toYYYYMM(timestamp))
ORDER BY (token_symbol, interval, timestamp)
TTL timestamp + toIntervalDay(365);

-- ============================================================================
-- TRADER ACTIVITY ANALYTICS
-- ============================================================================

-- Trader position changes over time
CREATE TABLE trader_position_history (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    trader_id String CODEC(ZSTD),
    trader_address String CODEC(ZSTD),
    token_symbol String CODEC(ZSTD),
    token_address String CODEC(ZSTD),
    side String CODEC(ZSTD), -- 'long', 'short'
    size Decimal(20, 8) CODEC(ZSTD),
    price Decimal(20, 8) CODEC(ZSTD),
    leverage Decimal(5, 2) CODEC(ZSTD),
    unrealized_pnl Decimal(20, 8) CODEC(ZSTD),
    portfolio_value Decimal(20, 8) CODEC(ZSTD),
    is_whale Boolean CODEC(ZSTD),
    confidence_score Decimal(3, 2) CODEC(ZSTD),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (trader_id, token_symbol, timestamp)
TTL timestamp + toIntervalDay(180);

-- Trader performance metrics
CREATE TABLE trader_performance_metrics (
    date Date CODEC(ZSTD),
    trader_id String CODEC(ZSTD),
    trader_address String CODEC(ZSTD),
    daily_pnl Decimal(20, 8) CODEC(ZSTD),
    cumulative_pnl Decimal(20, 8) CODEC(ZSTD),
    win_rate Decimal(5, 4) CODEC(ZSTD),
    total_trades UInt32 CODEC(ZSTD),
    winning_trades UInt32 CODEC(ZSTD),
    losing_trades UInt32 CODEC(ZSTD),
    avg_win_size Decimal(20, 8) CODEC(ZSTD),
    avg_loss_size Decimal(20, 8) CODEC(ZSTD),
    profit_factor Decimal(10, 4) CODEC(ZSTD),
    sharpe_ratio Decimal(10, 4) CODEC(ZSTD),
    max_drawdown Decimal(20, 8) CODEC(ZSTD),
    portfolio_turnover Decimal(20, 8) CODEC(ZSTD),
    followers_count UInt32 CODEC(ZSTD),
    copiers_count UInt32 CODEC(ZSTD),
    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (trader_id, date)
TTL date + toIntervalDay(730);

-- ============================================================================
-- COPY TRADING ANALYTICS
-- ============================================================================

-- Copy trading performance tracking
CREATE TABLE copy_trading_performance (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    follower_id String CODEC(ZSTD),
    trader_id String CODEC(ZSTD),
    relationship_id String CODEC(ZSTD),
    token_symbol String CODEC(ZSTD),
    copy_size Decimal(20, 8) CODEC(ZSTD),
    original_size Decimal(20, 8) CODEC(ZSTD),
    allocation_percentage Decimal(5, 2) CODEC(ZSTD),
    unrealized_pnl Decimal(20, 8) CODEC(ZSTD),
    realized_pnl Decimal(20, 8) CODEC(ZSTD),
    fees_paid Decimal(20, 8) CODEC(ZSTD),
    net_pnl Decimal(20, 8) CODEC(ZSTD),
    roi_percentage Decimal(5, 2) CODEC(ZSTD),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (follower_id, trader_id, timestamp)
TTL timestamp + toIntervalDay(365);

-- Copy trading alignment metrics
CREATE TABLE copy_alignment_metrics (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    trader_id String CODEC(ZSTD),
    follower_id String CODEC(ZSTD),
    alignment_score Decimal(5, 4) CODEC(ZSTD), -- 0 to 1, how well aligned
    position_diff_percentage Decimal(5, 2) CODEC(ZSTD),
    timing_lag_seconds UInt32 CODEC(ZSTD),
    missed_trades UInt32 CODEC(ZSTD),
    late_trades UInt32 CODEC(ZSTD),
    strategy_type String CODEC(ZSTD),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (trader_id, follower_id, timestamp)
TTL timestamp + toIntervalDay(180);

-- ============================================================================
-- MARKET SENTIMENT ANALYTICS
-- ============================================================================

-- Social sentiment indicators
CREATE TABLE social_sentiment (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    token_symbol String CODEC(ZSTD),
    platform String CODEC(ZSTD), -- 'twitter', 'telegram', 'reddit', etc.
    sentiment_score Decimal(5, 4) CODEC(ZSTD), -- -1 to 1
    mention_count UInt32 CODEC(ZSTD),
    positive_count UInt32 CODEC(ZSTD),
    negative_count UInt32 CODEC(ZSTD),
    neutral_count UInt32 CODEC(ZSTD),
    influence_score Decimal(5, 4) CODEC(ZSTD),
    keywords Array(String) CODEC(ZSTD),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (token_symbol, platform, timestamp)
TTL timestamp + toIntervalDay(90);

-- On-chain sentiment indicators
CREATE TABLE onchain_sentiment (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    token_symbol String CODEC(ZSTD),
    token_address String CODEC(ZSTD),
    large_transactions UInt32 CODEC(ZSTD), -- > $100k
    wallet_growth UInt32 CODEC(ZSTD),
    active_addresses UInt32 CODEC(ZSTD),
    transaction_volume Decimal(20, 8) CODEC(ZSTD),
    holding_distribution Array(UInt32) CODEC(ZSTD), -- bucketed holdings
    inflow_outflow_ratio Decimal(5, 4) CODEC(ZSTD),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (token_symbol, timestamp)
TTL timestamp + toIntervalDay(180);

-- ============================================================================
-- ALERT AND NOTIFICATION ANALYTICS
-- ============================================================================

-- Alert performance tracking
CREATE TABLE alert_performance (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    user_id String CODEC(ZSTD),
    alert_type String CODEC(ZSTD),
    token_symbol String CODEC(ZSTD),
    trigger_price Decimal(20, 8) CODEC(ZSTD),
    actual_price Decimal(20, 8) CODEC(ZSTD),
    accuracy_percentage Decimal(5, 2) CODEC(ZSTD),
    response_time_ms UInt32 CODEC(ZSTD),
    user_action String CODEC(ZSTD), -- 'viewed', 'acted', 'ignored'
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (user_id, alert_type, timestamp)
TTL timestamp + toIntervalDay(90);

-- ============================================================================
-- SYSTEM PERFORMANCE METRICS
-- ============================================================================

-- API performance tracking
CREATE TABLE api_metrics (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    endpoint String CODEC(ZSTD),
    method String CODEC(ZSTD),
    status_code UInt16 CODEC(ZSTD),
    response_time_ms UInt32 CODEC(ZSTD),
    request_size_bytes UInt32 CODEC(ZSTD),
    response_size_bytes UInt32 CODEC(ZSTD),
    user_id String CODEC(ZSTD),
    ip_address String CODEC(ZSTD),
    user_agent String CODEC(ZSTD),
    error_message String CODEC(ZSTD),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (endpoint, method, timestamp)
TTL timestamp + toIntervalDay(60);

-- WebSocket connection metrics
CREATE TABLE websocket_metrics (
    timestamp DateTime64(3) CODEC(Delta, ZSTD),
    connection_id String CODEC(ZSTD),
    user_id String CODEC(ZSTD),
    event_type String CODEC(ZSTD),
    message_size_bytes UInt32 CODEC(ZSTD),
    latency_ms UInt32 CODEC(ZSTD),
    disconnection_reason String CODEC(ZSTD),
    session_duration_seconds UInt32 CODEC(ZSTD),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (connection_id, timestamp)
TTL timestamp + toIntervalDay(30);

-- ============================================================================
-- AGGREGATED VIEWS
-- ============================================================================

-- Hourly market data summaries
CREATE MATERIALIZED VIEW hourly_market_summary
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (token_symbol, timestamp)
AS SELECT
    toStartOfHour(timestamp) AS timestamp,
    token_symbol,
    sum(volume) AS volume,
    avg(price) AS avg_price,
    min(price) AS min_price,
    max(price) AS max_price,
    first_value(price) AS open_price,
    last_value(price) AS close_price,
    count() AS data_points
FROM market_data
GROUP BY token_symbol, toStartOfHour(timestamp);

-- Daily trader rankings
CREATE MATERIALIZED VIEW daily_trader_rankings
ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMMDD(date)
ORDER BY (trader_id, date)
AS SELECT
    toDate(timestamp) AS date,
    trader_id,
    trader_address,
    sum(daily_pnl) AS daily_pnl,
    count() AS trades_count,
    win_rate,
    followers_count,
    row_number() OVER (PARTITION BY toDate(timestamp) ORDER BY sum(daily_pnl) DESC) AS daily_rank
FROM trader_performance_metrics
GROUP BY trader_id, trader_address, toDate(timestamp), win_rate, followers_count;

-- ============================================================================
-- FUNCTIONS FOR ANALYTICS
-- ============================================================================

-- Function to calculate moving averages
CREATE OR REPLACE FUNCTION moving_average AS (
    values Array(Decimal(20, 8)),
    window_size UInt32
) RETURNS Array(Decimal(20, 8))
LANGUAGE SQL AS $$
    SELECT arrayMap(i ->
        (arraySlice(values, greatest(1, i - window_size + 1), window_size)
         as window_values),
        if(length(window_values) > 0,
           arraySum(window_values) / length(window_values),
           toDecimal64(0, 8)
        )
    , arrayEnumerate(values))
$$;

-- Function to calculate RSI
CREATE OR REPLACE FUNCTION calculate_rsi AS (
    prices Array(Decimal(20, 8)),
    period UInt32 DEFAULT 14
) RETURNS Array(Decimal(10, 4))
LANGUAGE SQL AS $$
    WITH
        gains AS (
            SELECT arrayMap(i ->
                if(i > 0, prices[i] - prices[i-1], toDecimal64(0, 8))
            , arrayEnumerate(prices))
        ),
        losses AS (
            SELECT arrayMap(i ->
                if(i > 0, prices[i-1] - prices[i], toDecimal64(0, 8))
            , arrayEnumerate(prices))
        )
    SELECT
        arrayMap(i ->
            if(i >= period,
                let avg_gain = arrayAvg(arraySlice(gains, i - period + 1, period)),
                let avg_loss = arrayAvg(arraySlice(losses, i - period + 1, period)),
                if(avg_loss > 0,
                    100 - (100 / (1 + avg_gain / avg_loss)),
                    100
                ),
                toDecimal64(50, 4)
            )
        , arrayEnumerate(prices))
$$;

-- ============================================================================
-- RETENTION POLICIES
-- ============================================================================

-- Create policies for different data retention periods
ALTER TABLE market_data MODIFY TTL timestamp + toIntervalDay(90);
ALTER TABLE ohlcv_data MODIFY TTL timestamp + toIntervalDay(365);
ALTER TABLE trader_position_history MODIFY TTL timestamp + toIntervalDay(180);
ALTER TABLE trader_performance_metrics MODIFY TTL date + toIntervalDay(730);
ALTER TABLE copy_trading_performance MODIFY TTL timestamp + toIntervalDay(365);
ALTER TABLE copy_alignment_metrics MODIFY TTL timestamp + toIntervalDay(180);
ALTER TABLE social_sentiment MODIFY TTL timestamp + toIntervalDay(90);
ALTER TABLE onchain_sentiment MODIFY TTL timestamp + toIntervalDay(180);
ALTER TABLE alert_performance MODIFY TTL timestamp + toIntervalDay(90);
ALTER TABLE api_metrics MODIFY TTL timestamp + toIntervalDay(60);
ALTER TABLE websocket_metrics MODIFY TTL timestamp + toIntervalDay(30);
