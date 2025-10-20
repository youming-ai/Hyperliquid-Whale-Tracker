// ClickHouse Table Definitions for HyperDash Platform
// These tables are optimized for time-series analytics and high-volume data ingestion

export const MARKET_TICKS_RAW = `
CREATE TABLE IF NOT EXISTS market_ticks_raw (
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
`;

export const MARKET_OHLCV_1MIN = `
CREATE TABLE IF NOT EXISTS market_ohlcv_1min (
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
`;

export const TRADER_EVENTS = `
CREATE TABLE IF NOT EXISTS trader_events (
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
`;

export const TRADER_KPIS_DAY = `
CREATE TABLE IF NOT EXISTS trader_kpis_day (
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
`;

export const LIQ_HEATMAP_BINS = `
CREATE TABLE IF NOT EXISTS liq_heatmap_bins (
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
`;

export const COPY_TRADE_EVENTS = `
CREATE TABLE IF NOT EXISTS copy_trade_events (
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
`;

// Materialized Views for real-time aggregations
export const MV_OHLCV_1MIN = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ohlcv_1min TO market_ohlcv_1min AS
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
`;

export const MV_TRADER_KPIS_DAY = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trader_kpis_day TO trader_kpis_day AS
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
`;

export const MV_LIQ_HEATMAP_REALTIME = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_liq_heatmap_realtime TO liq_heatmap_bins AS
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
`;

// All table definitions for easy migration
export const ALL_TABLES = [
  MARKET_TICKS_RAW,
  MARKET_OHLCV_1MIN,
  TRADER_EVENTS,
  TRADER_KPIS_DAY,
  LIQ_HEATMAP_BINS,
  COPY_TRADE_EVENTS,
  MV_OHLCV_1MIN,
  MV_TRADER_KPIS_DAY,
  MV_LIQ_HEATMAP_REALTIME,
];
