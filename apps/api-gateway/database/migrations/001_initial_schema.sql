-- HyperDash Platform Database Schema
-- PostgreSQL Configuration for Transactional Data

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================================================
-- USER MANAGEMENT
-- ============================================================================

-- Users table for authentication and profiles
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    tier VARCHAR(20) NOT NULL DEFAULT 'freemium' CHECK (tier IN ('freemium', 'premium', 'enterprise')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    preferences JSONB DEFAULT '{}',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    stripe_customer_id VARCHAR(255)
);

-- User sessions for authentication
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- ============================================================================
-- TRADER PROFILES
-- ============================================================================

-- Whale traders we track
CREATE TABLE traders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(255) UNIQUE NOT NULL, -- Blockchain address
    nickname VARCHAR(100),
    bio TEXT,
    is_verified BOOLEAN DEFAULT false,
    verification_score DECIMAL(3,2) DEFAULT 0.0 CHECK (verification_score >= 0 AND verification_score <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_pnl DECIMAL(20,8) DEFAULT 0,
    win_rate DECIMAL(5,4) DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    followers INTEGER DEFAULT 0,
    avg_position_size DECIMAL(20,8) DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    social_links JSONB DEFAULT '{}'
);

-- Trader verification records
CREATE TABLE trader_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trader_id UUID NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
    verification_type VARCHAR(20) NOT NULL CHECK (verification_type IN ('onchain', 'social', 'manual')),
    evidence JSONB NOT NULL,
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- COPY TRADING
-- ============================================================================

-- Copy trading relationships
CREATE TABLE copy_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trader_id UUID NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
    allocation_percentage DECIMAL(5,2) NOT NULL CHECK (allocation_percentage > 0 AND allocation_percentage <= 100),
    max_allocation DECIMAL(20,8) NOT NULL DEFAULT 0,
    min_allocation DECIMAL(20,8) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    auto_rebalance BOOLEAN DEFAULT true,
    stop_loss_percentage DECIMAL(5,2) CHECK (stop_loss_percentage > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, trader_id)
);

-- Copy trading strategies
CREATE TABLE copy_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    relationship_id UUID NOT NULL REFERENCES copy_relationships(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    strategy_type VARCHAR(20) NOT NULL CHECK (strategy_type IN ('proportional', 'fixed', 'adaptive')),
    parameters JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- POSITIONS AND TRADES
-- ============================================================================

-- Current positions
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    trader_id UUID REFERENCES traders(id),
    token_symbol VARCHAR(20) NOT NULL,
    token_address VARCHAR(255) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('long', 'short')),
    size DECIMAL(20,8) NOT NULL,
    entry_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8),
    unrealized_pnl DECIMAL(20,8) DEFAULT 0,
    leverage DECIMAL(5,2) DEFAULT 1,
    funding_rate DECIMAL(10,8),
    liquidation_price DECIMAL(20,8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_copy_trade BOOLEAN DEFAULT false,
    copy_relationship_id UUID REFERENCES copy_relationships(id)
);

-- Trade history
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    trader_id UUID REFERENCES traders(id),
    position_id UUID REFERENCES positions(id),
    token_symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    size DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    fee DECIMAL(20,8) DEFAULT 0,
    realized_pnl DECIMAL(20,8) DEFAULT 0,
    transaction_hash VARCHAR(255),
    block_number BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_copy_trade BOOLEAN DEFAULT false,
    copy_relationship_id UUID REFERENCES copy_relationships(id)
);

-- ============================================================================
-- BILLING AND SUBSCRIPTIONS
-- ============================================================================

-- Subscription plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('freemium', 'premium', 'enterprise')),
    price DECIMAL(10,2) NOT NULL,
    interval VARCHAR(20) NOT NULL CHECK (interval IN ('month', 'year')),
    features JSONB NOT NULL,
    max_copies INTEGER,
    api_calls_per_month INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ALERTS AND NOTIFICATIONS
-- ============================================================================

-- Price alerts
CREATE TABLE price_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_symbol VARCHAR(20) NOT NULL,
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('price_above', 'price_below', 'percent_change')),
    target_price DECIMAL(20,8),
    percent_change DECIMAL(5,2),
    is_active BOOLEAN DEFAULT true,
    triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification logs
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_via VARCHAR(20)[] DEFAULT '{}'
);

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

-- Audit trail for important actions
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDICES
-- ============================================================================

-- User indices
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_tier ON users(tier);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Session indices
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Trader indices
CREATE INDEX idx_traders_address ON traders(address);
CREATE INDEX idx_traders_is_verified ON traders(is_verified);
CREATE INDEX idx_traders_total_pnl ON traders(total_pnl DESC);
CREATE INDEX idx_traders_win_rate ON traders(win_rate DESC);
CREATE INDEX idx_traders_followers ON traders(followers DESC);

-- Copy relationship indices
CREATE INDEX idx_copy_relationships_follower_id ON copy_relationships(follower_id);
CREATE INDEX idx_copy_relationships_trader_id ON copy_relationships(trader_id);
CREATE INDEX idx_copy_relationships_is_active ON copy_relationships(is_active);

-- Position indices
CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_positions_trader_id ON positions(trader_id);
CREATE INDEX idx_positions_token_symbol ON positions(token_symbol);
CREATE INDEX idx_positions_side ON positions(side);
CREATE INDEX idx_positions_created_at ON positions(created_at);
CREATE INDEX idx_positions_is_copy_trade ON positions(is_copy_trade);

-- Trade indices
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_trader_id ON trades(trader_id);
CREATE INDEX idx_trades_position_id ON trades(position_id);
CREATE INDEX idx_trades_token_symbol ON trades(token_symbol);
CREATE INDEX idx_trades_created_at ON trades(created_at);
CREATE INDEX idx_trades_is_copy_trade ON trades(is_copy_trade);

-- Subscription indices
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_current_period_end ON user_subscriptions(current_period_end);

-- Alert indices
CREATE INDEX idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX idx_price_alerts_token_symbol ON price_alerts(token_symbol);
CREATE INDEX idx_price_alerts_is_active ON price_alerts(is_active);

-- Notification indices
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Audit indices
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_traders_updated_at BEFORE UPDATE ON traders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_copy_relationships_updated_at BEFORE UPDATE ON copy_relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_copy_strategies_updated_at BEFORE UPDATE ON copy_strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate portfolio value
CREATE OR REPLACE FUNCTION calculate_portfolio_value(p_user_id UUID)
RETURNS DECIMAL(20,8) AS $$
DECLARE
    total_value DECIMAL(20,8) := 0;
BEGIN
    SELECT COALESCE(SUM(size * current_price), 0) INTO total_value
    FROM positions
    WHERE user_id = p_user_id AND size > 0;

    RETURN total_value;
END;
$$ LANGUAGE plpgsql;

-- Function to update trader stats
CREATE OR REPLACE FUNCTION update_trader_stats(p_trader_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE traders
    SET
        total_trades = (SELECT COUNT(*) FROM trades WHERE trader_id = p_trader_id),
        total_pnl = (SELECT COALESCE(SUM(realized_pnl), 0) FROM trades WHERE trader_id = p_trader_id),
        win_rate = CASE
            WHEN (SELECT COUNT(*) FROM trades WHERE trader_id = p_trader_id) > 0 THEN
                (SELECT COUNT(*) FROM trades WHERE trader_id = p_trader_id AND realized_pnl > 0)::DECIMAL /
                (SELECT COUNT(*) FROM trades WHERE trader_id = p_trader_id)
            ELSE 0
        END
    WHERE id = p_trader_id;
END;
$$ LANGUAGE plpgsql;
