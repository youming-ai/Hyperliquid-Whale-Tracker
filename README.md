# 🚀 HyperDash Platform

A comprehensive data intelligence and copy trading platform for the Hyperliquid derivatives ecosystem. Built with modern microservices architecture to handle high-frequency data processing and sub-second trading execution.

## ✨ Key Features

### 📊 Market Intelligence
- **Real-time Market Data**: Live price feeds and OHLCV data
- **Liquidation Heatmaps**: Visual representation of liquidation risk levels
- **Market Analytics**: Advanced market metrics and insights
- **Price Alerts**: Customizable price notifications

### 👥 Trader Analytics
- **Trader Profiles**: Detailed trader performance metrics
- **Rankings System**: Top traders by various performance metrics
- **Performance Tracking**: Historical performance analysis
- **Risk Metrics**: Comprehensive risk assessment tools

### 🔄 Copy Trading
- **Strategy Management**: Create and manage copy trading strategies
- **Risk Controls**: Advanced risk management features
- **Real-time Execution**: Sub-second trade copying
- **Performance Analytics**: Track copy trading performance

### 📈 Analytics Dashboard
- **Platform Metrics**: Comprehensive platform analytics
- **User Insights**: User behavior and engagement metrics
- **Performance Tracking**: System performance monitoring
- **Business Intelligence**: Advanced analytics and reporting

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Node.js, TypeScript, tRPC
- **Trading Engine**: Go (high-performance execution)
- **Databases**: PostgreSQL (transactional), ClickHouse (analytics), Redis (caching)
- **Event Streaming**: Redpanda (Kafka-compatible)
- **Monitoring**: Prometheus, Grafana
- **Containerization**: Docker, Docker Compose

### Microservices Architecture
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

## 🚀 Quick Start

### Prerequisites
- **Docker** and **Docker Compose**
- **Node.js** 18+ 
- **Go** 1.21+ (for copy trading engine)
- **Git**

### 1. Clone Repository
```bash
git clone https://github.com/your-org/hyperdash-platform.git
cd hyperdash-platform
```

### 2. Run Setup Script
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 3. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Get Hyperliquid API Keys
1. Visit [Hyperliquid](https://hyperliquid.xyz/)
2. Create API keys in your account settings
3. Add them to your `.env` file:
   ```env
   HYPERLIQUID_API_KEY=your_api_key
   HYPERLIQUID_SECRET_KEY=your_secret_key
   ```

### 5. Start Development Environment
```bash
./start-dev.sh
```

### 6. Access the Application
- **Frontend**: http://localhost:3001
- **API Gateway**: http://localhost:3000
- **Grafana**: http://localhost:3002 (admin/admin)
- **Prometheus**: http://localhost:9090

## 📁 Project Structure

```
hyperdash-platform/
├── apps/                    # Application services
│   ├── web/                # Next.js frontend
│   ├── api-gateway/        # tRPC API gateway
│   ├── data-ingestion/     # Market data service
│   ├── analytics/          # Analytics service
│   ├── copy-engine/        # Go trading engine
│   └── billing/            # Billing service
├── packages/               # Shared packages
│   ├── shared-types/       # TypeScript types
│   ├── database/           # Database schemas
│   └── contracts/          # API contracts
├── specs/                  # Feature specifications
├── infrastructure/         # Infrastructure configs
└── scripts/               # Utility scripts
```

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev              # Start all services in development mode
npm run build            # Build all packages and applications
npm run start            # Start production servers

# Database
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed database with sample data

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run format           # Format code with Prettier
npm run type-check       # TypeScript type checking

# Testing
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
```

### Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# Database
DATABASE_URL=postgresql://hyperdash:password@localhost:5432/hyperdash
CLICKHOUSE_URL=http://localhost:8123
REDIS_URL=redis://localhost:6379

# API
JWT_SECRET=your-jwt-secret
NEXT_PUBLIC_API_URL=http://localhost:3001

# Hyperliquid API
HYPERLIQUID_API_KEY=your-api-key
HYPERLIQUID_SECRET_KEY=your-secret-key
```

## 📚 API Documentation

The platform uses tRPC for type-safe APIs. Available endpoints include:

- **Market Data**: Real-time market overview, OHLCV data, heatmaps
- **Traders**: Trader profiles, performance metrics, rankings
- **Strategies**: Copy trading strategy management
- **Analytics**: Advanced market analytics and insights

See `packages/contracts/src/routers/` for complete API definitions.

## 🔌 WebSocket Events

Real-time data streaming via WebSocket:

```javascript
// Connect to WebSocket
const socket = io('ws://localhost:3001', {
  auth: { token: 'your-jwt-token' }
});

// Subscribe to market data
socket.emit('subscribe', { room: 'market:BTC-PERP' });

// Receive real-time updates
socket.on('broadcast', (message) => {
  console.log('Market update:', message);
});
```

## 🔒 Security

### Authentication Methods
- **Wallet-based**: Sign message with blockchain wallet
- **JWT tokens**: Secure session management
- **KYC levels**: Tiered access control

### Security Features
- **Rate limiting**: Prevent API abuse
- **Input validation**: Comprehensive data validation
- **Audit logging**: Complete audit trail
- **Encryption**: Data encryption at rest and in transit

## 📈 Monitoring

### Metrics Available
- **API Performance**: Response times, error rates
- **Database Performance**: Query times, connection pools
- **Business Metrics**: User activity, trading volume
- **System Health**: Resource usage, uptime

### Monitoring Tools
- **Prometheus**: Metrics collection
- **Grafana**: Visualization and alerting
- **Structured Logs**: Detailed logging with context

## 🧪 Testing

### Test Structure
```
tests/
├── unit/                   # Unit tests
├── integration/            # Integration tests
├── e2e/                   # End-to-end tests
└── fixtures/              # Test data
```

### Running Tests
```bash
# All tests
npm run test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

## 🚢 Deployment

### Development
```bash
docker-compose up -d
```

### Production
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy with Kubernetes
kubectl apply -f infrastructure/kubernetes/
```

### Environment Configuration
- **Development**: Hot reload, debug logs, test data
- **Staging**: Production-like configuration
- **Production**: Optimized for performance and security

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style
- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write meaningful commit messages
- Include tests for new features

### Development Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes
# ...

# Run tests
npm run test
npm run lint

# Commit and push
git commit -m "feat: add new feature"
git push origin feature/your-feature
```

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- **Documentation**: [docs.hyperdash.io](https://docs.hyperdash.io)
- **Issues**: [GitHub Issues](https://github.com/your-org/hyperdash-platform/issues)
- **Discord**: [Community Discord](https://discord.gg/hyperdash)
- **Email**: support@hyperdash.io

## 🚀 Roadmap

### Phase 1: Core Platform ✅
- [x] Basic market data
- [x] Trader analytics
- [x] Copy trading engine
- [x] User management

### Phase 2: Advanced Features
- [ ] Advanced analytics
- [ ] Social features
- [ ] Mobile app
- [ ] API access

### Phase 3: Enterprise Features
- [ ] Multi-exchange support
- [ ] Advanced risk management
- [ ] Institutional features
- [ ] White-label solutions

## 📊 Performance

### Target Metrics
- **Market Data Latency**: P95 ≤ 500ms
- **Copy Trading Execution**: P95 ≤ 1000ms
- **Concurrent Users**: 3,000+
- **Throughput**: 10,000+ messages/second

### Optimization
- **Database Indexing**: Optimized query performance
- **Caching**: Multi-layer caching strategy
- **Connection Pooling**: Efficient resource usage
- **Load Balancing**: Horizontal scaling support

---

**Built with ❤️ for the Hyperliquid community**