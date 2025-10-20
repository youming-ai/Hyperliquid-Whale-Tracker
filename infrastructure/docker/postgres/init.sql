-- HyperDash PostgreSQL initialization script
-- This script runs when the PostgreSQL container first starts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create a simple test table to verify connection
CREATE TABLE IF NOT EXISTS connection_test (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    message TEXT DEFAULT 'PostgreSQL is connected and working!'
);

-- Insert a test record
INSERT INTO connection_test (message) VALUES
    ('HyperDash PostgreSQL database initialized successfully!'),
    ('Database is ready for application connections'),
    ('All required extensions have been loaded');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_connection_test_created_at ON connection_test(created_at);

-- Create a view for quick health checks
CREATE OR REPLACE VIEW db_health AS
SELECT
    'healthy' as status,
    COUNT(*) as test_records,
    MAX(created_at) as last_test,
    version() as postgres_version
FROM connection_test;

-- Grant permissions (adjust based on your user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO hyperdash;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO hyperdash;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE '✅ HyperDash PostgreSQL database initialized successfully';
    RAISE NOTICE '✅ Extensions: uuid-ossp, pgcrypto, btree_gin loaded';
    RAISE NOTICE '✅ Test data and views created';
END $$;
