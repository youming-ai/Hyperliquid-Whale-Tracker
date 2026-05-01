CREATE TABLE IF NOT EXISTS trader_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id uuid NOT NULL REFERENCES trader_stats(trader_id) ON DELETE CASCADE,
  trader_address text NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL,
  quantity numeric(20, 8) NOT NULL,
  entry_price numeric(20, 8) NOT NULL,
  mark_price numeric(20, 8) NOT NULL,
  position_value_usd numeric(20, 2) NOT NULL,
  unrealized_pnl numeric(20, 2) DEFAULT '0',
  margin_used numeric(20, 2) DEFAULT '0',
  leverage numeric(8, 2) DEFAULT '1',
  liquidation_price numeric(20, 8),
  metadata jsonb DEFAULT '{}',
  last_updated_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trader_positions_trader_id ON trader_positions(trader_id);
CREATE INDEX IF NOT EXISTS idx_trader_positions_address ON trader_positions(trader_address);
CREATE INDEX IF NOT EXISTS idx_trader_positions_symbol ON trader_positions(symbol);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trader_positions_unique ON trader_positions(trader_id, symbol, side);
