import postgres from 'postgres';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hyperdash';

async function runCopyTradingMigrations() {
  console.log('Starting Copy Trading migrations...');

  const client = postgres(connectionString, { max: 1 });

  try {
    // Create users table (if not exists from other migrations)
    await client`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'suspended', 'closed')),
        kyc_level INTEGER DEFAULT 0,
        preferences JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('✅ Users table created');

    // Create agent_wallets table
    await client`
      CREATE TABLE IF NOT EXISTS agent_wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exchange TEXT NOT NULL DEFAULT 'hyperliquid',
        address TEXT NOT NULL,
        status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive', 'suspended')),
        min_order_usd DECIMAL(18, 8) DEFAULT 5.0 CHECK (min_order_usd > 0),
        max_leverage INTEGER DEFAULT 5 CHECK (max_leverage > 0),
        permissions JSONB DEFAULT '{"trade": true, "withdraw": false}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('✅ Agent wallets table created');

    // Create copy_strategies table
    await client`
      CREATE TABLE IF NOT EXISTS copy_strategies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'paused' NOT NULL CHECK (status IN ('paused', 'active', 'error', 'terminated')),
        mode TEXT DEFAULT 'portfolio' NOT NULL CHECK (mode IN ('portfolio', 'single_trader')),
        max_leverage DECIMAL(5, 2) DEFAULT 5.0 CHECK (max_leverage > 0),
        max_position_usd DECIMAL(18, 8),
        slippage_bps INTEGER DEFAULT 10 CHECK (slippage_bps >= 0),
        min_order_usd DECIMAL(18, 8) DEFAULT 5.0 CHECK (min_order_usd > 0),
        follow_new_entries_only BOOLEAN DEFAULT true,
        auto_rebalance BOOLEAN DEFAULT true,
        rebalance_threshold_bps INTEGER DEFAULT 50,
        total_pnl DECIMAL(18, 8) DEFAULT 0,
        total_fees DECIMAL(18, 8) DEFAULT 0,
        alignment_rate DECIMAL(5, 2) DEFAULT 100.0 CHECK (alignment_rate >= 0 AND alignment_rate <= 100),
        agent_wallet_id UUID REFERENCES agent_wallets(id) ON DELETE SET NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('✅ Copy strategies table created');

    // Create copy_allocations table
    await client`
      CREATE TABLE IF NOT EXISTS copy_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        strategy_id UUID NOT NULL REFERENCES copy_strategies(id) ON DELETE CASCADE,
        trader_id UUID NOT NULL REFERENCES trader_stats(trader_id) ON DELETE CASCADE,
        weight DECIMAL(5, 4) NOT NULL CHECK (weight > 0 AND weight <= 1),
        status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'paused')),
        allocated_pnl DECIMAL(18, 8) DEFAULT 0,
        allocated_fees DECIMAL(18, 8) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('✅ Copy allocations table created');

    // Create copy_orders table
    await client`
      CREATE TABLE IF NOT EXISTS copy_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        strategy_id UUID REFERENCES copy_strategies(id) ON DELETE SET NULL,
        agent_wallet_id UUID REFERENCES agent_wallets(id) ON DELETE SET NULL,
        source_trader_id UUID REFERENCES trader_stats(trader_id),
        source_trade_id UUID REFERENCES trader_trades(id),
        exchange TEXT NOT NULL DEFAULT 'hyperliquid',
        symbol TEXT NOT NULL,
        side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
        order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit')),
        quantity DECIMAL(20, 8) NOT NULL CHECK (quantity > 0),
        price DECIMAL(20, 8),
        status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'submitted', 'filled', 'partial', 'cancelled', 'failed')),
        filled_quantity DECIMAL(20, 8) DEFAULT 0 CHECK (filled_quantity >= 0),
        average_price DECIMAL(20, 8),
        pnl DECIMAL(18, 2) DEFAULT 0,
        fee_usd DECIMAL(18, 2) DEFAULT 0,
        exchange_order_id TEXT,
        error_code TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        submitted_at TIMESTAMPTZ,
        filled_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ
      );
    `;
    console.log('✅ Copy orders table created');

    // Create copy_positions table
    await client`
      CREATE TABLE IF NOT EXISTS copy_positions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        strategy_id UUID REFERENCES copy_strategies(id) ON DELETE SET NULL,
        agent_wallet_id UUID REFERENCES agent_wallets(id) ON DELETE SET NULL,
        source_trader_id UUID REFERENCES trader_stats(trader_id),
        exchange TEXT NOT NULL DEFAULT 'hyperliquid',
        symbol TEXT NOT NULL,
        side TEXT NOT NULL CHECK (side IN ('long', 'short')),
        quantity DECIMAL(20, 8) NOT NULL,
        entry_price DECIMAL(20, 8) NOT NULL,
        mark_price DECIMAL(20, 8),
        unrealized_pnl DECIMAL(18, 2) DEFAULT 0,
        realized_pnl DECIMAL(18, 2) DEFAULT 0,
        leverage DECIMAL(5, 2) DEFAULT 1,
        margin_used DECIMAL(18, 2) DEFAULT 0,
        opened_at TIMESTAMPTZ DEFAULT NOW(),
        last_updated_at TIMESTAMPTZ DEFAULT NOW(),
        closed_at TIMESTAMPTZ
      );
    `;
    console.log('✅ Copy positions table created');

    // Create indexes
    console.log('Creating indexes...');

    // Users indexes
    await client`CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);`;
    await client`CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);`;

    // Agent wallets indexes
    await client`CREATE INDEX IF NOT EXISTS idx_agent_wallets_user_id ON agent_wallets(user_id);`;
    await client`CREATE INDEX IF NOT EXISTS idx_agent_wallets_address ON agent_wallets(address);`;
    await client`CREATE INDEX IF NOT EXISTS idx_agent_wallets_status ON agent_wallets(status);`;

    // Copy strategies indexes
    await client`CREATE INDEX IF NOT EXISTS idx_copy_strategies_user_id ON copy_strategies(user_id);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_strategies_status ON copy_strategies(status);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_strategies_agent_wallet ON copy_strategies(agent_wallet_id);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_strategies_total_pnl ON copy_strategies(total_pnl);`;

    // Copy allocations indexes
    await client`CREATE INDEX IF NOT EXISTS idx_copy_allocations_strategy_id ON copy_allocations(strategy_id);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_allocations_trader_id ON copy_allocations(trader_id);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_allocations_status ON copy_allocations(status);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_allocations_unique ON copy_allocations(strategy_id, trader_id);`;

    // Copy orders indexes
    await client`CREATE INDEX IF NOT EXISTS idx_copy_orders_user_id ON copy_orders(user_id);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_orders_strategy_id ON copy_orders(strategy_id);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_orders_agent_wallet ON copy_orders(agent_wallet_id);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_orders_source_trader ON copy_orders(source_trader_id);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_orders_status ON copy_orders(status);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_orders_symbol ON copy_orders(symbol);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_orders_created_at ON copy_orders(created_at);`;

    // Copy positions indexes
    await client`CREATE INDEX IF NOT EXISTS idx_copy_positions_user_id ON copy_positions(user_id);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_positions_strategy_id ON copy_positions(strategy_id);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_positions_agent_wallet ON copy_positions(agent_wallet_id);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_positions_symbol ON copy_positions(symbol);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_positions_side ON copy_positions(side);`;
    await client`CREATE INDEX IF NOT EXISTS idx_copy_positions_unique ON copy_positions(user_id, agent_wallet_id, symbol);`;

    // Create triggers for updated_at columns
    console.log('Creating triggers...');

    await client.unsafe(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.unsafe(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.unsafe(`
      DROP TRIGGER IF EXISTS update_agent_wallets_updated_at ON agent_wallets;
      CREATE TRIGGER update_agent_wallets_updated_at
        BEFORE UPDATE ON agent_wallets
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.unsafe(`
      DROP TRIGGER IF EXISTS update_copy_strategies_updated_at ON copy_strategies;
      CREATE TRIGGER update_copy_strategies_updated_at
        BEFORE UPDATE ON copy_strategies
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.unsafe(`
      DROP TRIGGER IF EXISTS update_copy_allocations_updated_at ON copy_allocations;
      CREATE TRIGGER update_copy_allocations_updated_at
        BEFORE UPDATE ON copy_allocations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.unsafe(`
      DROP TRIGGER IF EXISTS update_copy_positions_last_updated_at ON copy_positions;
      CREATE TRIGGER update_copy_positions_last_updated_at
        BEFORE UPDATE ON copy_positions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✅ Copy Trading migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run migrations if called directly
if (require.main === module) {
  runCopyTradingMigrations()
    .then(() => {
      console.log('✅ All migrations completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export default runCopyTradingMigrations;
