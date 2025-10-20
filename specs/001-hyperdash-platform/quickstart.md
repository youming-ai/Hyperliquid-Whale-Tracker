# HyperDash Platform Quick Start Guide

**Version**: 1.0  
**Date**: 2025-01-18  
**Target**: Developers and System Administrators

## Overview

This guide provides step-by-step instructions for setting up and deploying the HyperDash platform. HyperDash is a comprehensive trading intelligence and copy trading platform for the Hyperliquid derivatives ecosystem.

## Prerequisites

### System Requirements
- **CPU**: 8+ cores (16+ recommended for production)
- **Memory**: 32GB+ RAM (64GB+ recommended for production)
- **Storage**: 500GB+ SSD (2TB+ recommended for production with data retention)
- **Network**: 1Gbps+ connection with low latency to exchange APIs

### Software Requirements
- **Docker**: 20.10+ and Docker Compose 2.0+
- **Node.js**: 18.0+ for development
- **Go**: 1.21+ for trading engine development
- **Git**: 2.30+
- **kubectl**: 1.25+ (for Kubernetes deployment)

### External Services
- **Hyperliquid API Access**: API keys for market data and trading
- **Cloud Provider**: AWS, GCP, or Azure account
- **Domain Name**: For SSL certificates and API endpoints
- **Monitoring**: Prometheus/Grafana (optional but recommended)

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │  Data Ingestion │
│   (Next.js)     │◄──►│   (tRPC)        │◄──►│   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌────────┼────────┐
                       ▼                ▼
                ┌─────────────┐  ┌─────────────┐
                │   Analytics │  │Copy Engine │
                │ (Flink)     │  │    (Go)     │
                └─────────────┘  └─────────────┘
                       │                │
                       ▼                ▼
                ┌─────────────┐  ┌─────────────┐
                │ ClickHouse  │  │ PostgreSQL  │
                │ (Analytics) │  │(Transactional)│
                └─────────────┘  └─────────────┘
```

## Quick Start (Docker Compose)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/hyperdash-platform.git
cd hyperdash-platform
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### 3. Environment Variables

```bash
# Database Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=hyperdash
POSTGRES_USER=hyperdash
POSTGRES_PASSWORD=your_secure_password

# ClickHouse Configuration
CLICKHOUSE_HOST=clickhouse
CLICKHOUSE_PORT=9000
CLICKHOUSE_DB=hyperdash_analytics
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=

# Redpanda Configuration
REDPANDA_BOOTSTRAP_SERVERS=redpanda:9092
REDPANDA_KSQL_SERVER=http://redpanda:8088

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Application Configuration
NODE_ENV=development
API_PORT=3000
FRONTEND_PORT=3001

# Hyperliquid API Configuration
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz/info
HYPERLIQUID_WS_URL=wss://api.hyperliquid.xyz/ws
HYPERLIQUID_API_KEY=your_api_key
HYPERLIQUID_API_SECRET=your_api_secret

# Security
JWT_SECRET=your_jwt_secret_key
ENCRYPTION_KEY=your_32_character_encryption_key

# Monitoring (Optional)
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
```

### 4. Start Services

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 5. Initialize Database

```bash
# Run database migrations
docker-compose exec api npm run migrate

# Seed initial data (optional)
docker-compose exec api npm run seed
```

### 6. Verify Installation

```bash
# Check API health
curl http://localhost:3000/api/health

# Check frontend
open http://localhost:3001

# Verify database connections
docker-compose exec api npm run db:check
```

## Development Setup

### 1. Install Dependencies

```bash
# Frontend dependencies
cd apps/web
npm install

# API dependencies
cd ../../apps/api-gateway
npm install

# Trading engine dependencies
cd ../../apps/copy-engine
go mod download

# Analytics dependencies
cd ../../apps/analytics
# (Java/Flink dependencies managed in Docker)
```

### 2. Start Development Services

```bash
# Start infrastructure services
docker-compose up -d postgres clickhouse redpanda redis

# Start application services in development mode
npm run dev

# Or start individual services
cd apps/api-gateway && npm run dev
cd apps/web && npm run dev
cd apps/copy-engine && go run cmd/server/main.go
```

### 3. Run Tests

```bash
# Frontend tests
cd apps/web && npm test

# API tests
cd apps/api-gateway && npm test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e
```

## Production Deployment (Kubernetes)

### 1. Prepare Infrastructure

```bash
# Create namespace
kubectl create namespace hyperdash

# Apply secrets
kubectl apply -f infrastructure/k8s/secrets/

# Apply configurations
kubectl apply -f infrastructure/k8s/configmaps/
```

### 2. Deploy Databases

```bash
# Deploy PostgreSQL
kubectl apply -f infrastructure/k8s/postgres/

# Deploy ClickHouse
kubectl apply -f infrastructure/k8s/clickhouse/

# Deploy Redpanda
kubectl apply -f infrastructure/k8s/redpanda/

# Deploy Redis
kubectl apply -f infrastructure/k8s/redis/

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n hyperdash --timeout=300s
```

### 3. Deploy Application Services

```bash
# Deploy API Gateway
kubectl apply -f infrastructure/k8s/api-gateway/

# Deploy Frontend
kubectl apply -f infrastructure/k8s/frontend/

# Deploy Data Ingestion
kubectl apply -f infrastructure/k8s/data-ingestion/

# Deploy Analytics
kubectl apply -f infrastructure/k8s/analytics/

# Deploy Copy Engine
kubectl apply -f infrastructure/k8s/copy-engine/

# Wait for all services to be ready
kubectl wait --for=condition=ready pod -l app=hyperdash -n hyperdash --timeout=600s
```

### 4. Configure Ingress and SSL

```bash
# Deploy Ingress
kubectl apply -f infrastructure/k8s/ingress/

# Setup SSL certificates (cert-manager)
kubectl apply -f infrastructure/k8s/certificates/
```

### 5. Verify Deployment

```bash
# Check pod status
kubectl get pods -n hyperdash

# Check services
kubectl get services -n hyperdash

# Check ingress
kubectl get ingress -n hyperdash

# Test API endpoint
curl https://api.hyperdash.io/health
```

## Monitoring and Observability

### 1. Prometheus Metrics

```bash
# Access Prometheus
open http://localhost:9090

# Key metrics to monitor:
# - Request latency and error rates
# - Database connection pools
# - Kafka consumer lag
# - Trading execution latency
# - Copy trading alignment rates
```

### 2. Grafana Dashboards

```bash
# Access Grafana
open http://localhost:3001

# Default dashboards:
# - System Overview
# - Trading Performance
# - Market Data Pipeline
# - User Activity
```

### 3. Log Aggregation

```bash
# View application logs
kubectl logs -f deployment/api-gateway -n hyperdash
kubectl logs -f deployment/copy-engine -n hyperdash

# Structured logging with correlation IDs
grep "correlation_id" /var/log/hyperdash/*.log
```

## Common Tasks

### Adding New Market Data Sources

1. **Create Collector Service**
```bash
# New collector in apps/data-ingestion/src/collectors/
npm run generate:collector -- --name=newexchange
```

2. **Configure Data Pipeline**
```yaml
# infrastructure/k8s/data-ingestion/config.yaml
collectors:
  - name: newexchange
    type: websocket
    url: wss://api.newexchange.com/ws
    symbols: ["BTC-PERP", "ETH-PERP"]
```

3. **Update Schema**
```sql
-- Add exchange-specific columns to market_ticks_raw
ALTER TABLE market_ticks_raw 
ADD COLUMN newexchange_specific_field String;
```

### Scaling Copy Trading Engine

```bash
# Horizontal scaling
kubectl scale deployment copy-engine --replicas=3 -n hyperdash

# Configure partitioning
kubectl patch deployment copy-engine -p '{"spec":{"template":{"spec":{"containers":[{"name":"copy-engine","env":[{"name":"PARTITION_ID","valueFrom":{"fieldRef":{"fieldPath":"metadata.uid"}}}]}]}}}}'
```

### Database Maintenance

```bash
# PostgreSQL backup
kubectl exec -it postgres-0 -n hyperdash -- pg_dump hyperdash > backup.sql

# ClickHouse backup
kubectl exec -it clickhouse-0 -n hyperdash -- clickhouse-client --query="BACKUP TABLE market_ticks_raw TO Disk('backups/market_ticks_backup')"

# Data retention cleanup
kubectl exec -it clickhouse-0 -n hyperdash -- clickhouse-client --query="ALTER TABLE market_ticks_raw DELETE WHERE timestamp < now() - INTERVAL 90 DAY"
```

## Security Configuration

### 1. API Security

```yaml
# Rate limiting
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: rate-limit
spec:
  rateLimit:
    average: 100
    burst: 200
```

### 2. Network Policies

```yaml
# Database access restrictions
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-access
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway
    ports:
    - protocol: TCP
      port: 5432
```

### 3. Secrets Management

```bash
# Create secrets
kubectl create secret generic hyperdash-secrets \
  --from-literal=postgres-password=your_secure_password \
  --from-literal=jwt-secret=your_jwt_secret \
  --from-literal=hyperliquid-api-key=your_api_key \
  -n hyperdash

# Rotate secrets
kubectl create secret generic hyperdash-secrets-v2 \
  --from-literal=postgres-password=new_secure_password \
  --dry-run=client -o yaml | kubectl apply -f -
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
```bash
# Check database connectivity
kubectl exec -it postgres-0 -n hyperdash -- psql -U hyperdash -d hyperdash

# Check connection pool status
curl http://localhost:3000/metrics | grep db_connections
```

2. **High Kafka Lag**
```bash
# Check consumer lag
kubectl exec -it redpanda-0 -n hyperdash -- rpk group list

# Reset consumer offsets
kubectl exec -it redpanda-0 -n hyperdash -- rpk group reset-offsets --group hyperdash-consumer --to-earliest
```

3. **Copy Trading Delays**
```bash
# Check execution latency
curl http://localhost:3000/metrics | grep copy_execution_latency

# Review error logs
kubectl logs -f deployment/copy-engine -n hyperdash | grep ERROR
```

### Performance Tuning

1. **ClickHouse Optimization**
```sql
-- Optimize table settings
ALTER TABLE market_ticks_raw MODIFY SETTING index_granularity = 4096;

-- Create projections for common queries
ALTER TABLE market_ticks_raw ADD PROJECTION symbol_summary (
    SELECT symbol, count(), min(price), max(price), avg(volume)
    GROUP BY symbol
);
```

2. **Application Performance**
```bash
# Increase worker processes
kubectl patch deployment api-gateway -p '{"spec":{"template":{"spec":{"containers":[{"name":"api-gateway","env":[{"name":"WORKERS","value":"8"}]}]}}}}'

# Enable caching
kubectl patch deployment api-gateway -p '{"spec":{"template":{"spec":{"containers":[{"name":"api-gateway","env":[{"name":"REDIS_CACHE_TTL","value":"300"}]}]}}}}'
```

## Support and Resources

### Documentation
- [API Documentation](https://docs.hyperdash.io/api)
- [Architecture Guide](https://docs.hyperdash.io/architecture)
- [Security Best Practices](https://docs.hyperdash.io/security)

### Community
- [GitHub Discussions](https://github.com/your-org/hyperdash-platform/discussions)
- [Discord Community](https://discord.gg/hyperdash)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/hyperdash)

### Support
- Email: support@hyperdash.io
- Status Page: https://status.hyperdash.io
- Bug Reports: [GitHub Issues](https://github.com/your-org/hyperdash-platform/issues)

## Next Steps

1. **Configure Hyperliquid API**: Obtain and configure API credentials
2. **Set Up Monitoring**: Deploy Prometheus and Grafana for production monitoring
3. **Configure Backup**: Set up automated database backups
4. **Security Hardening**: Review and implement security best practices
5. **Performance Testing**: Load test the system with expected traffic patterns
6. **User Onboarding**: Set up user authentication and KYC processes

For detailed information on any of these topics, please refer to the comprehensive documentation available at [docs.hyperdash.io](https://docs.hyperdash.io).