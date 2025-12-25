# HyperDash Platform - Project Status

## Overview

**Version**: 1.0.0
**Status**: Production Ready
**Last Updated**: 2025-12

---

## Architecture

### Microservices (6 services)

| Service | Technology | Port | Status |
|---------|------------|------|--------|
| Web Frontend | TanStack Start + TypeScript | 3001 | ✅ |
| API Gateway | Hono + Bun | 3000 | ✅ |
| Data Ingestion | Node.js + WebSocket | 3003 | ✅ |
| Analytics | Node.js + ClickHouse | 3004 | ✅ |
| Copy Engine | Go | 3006 | ✅ |
| Billing | Node.js + Stripe | 3005 | ✅ |

### Infrastructure

| Component | Technology | Port |
|-----------|------------|------|
| PostgreSQL | Supabase / Docker | 5432 |
| ClickHouse | Docker / Cloud | 8123 |
| Redis | Docker / Upstash | 6379 |
| Kafka | Docker | 9092 |

---

## Features

- ✅ Real-time market data streaming
- ✅ Trader analytics and ranking
- ✅ Copy trading with multiple strategies
- ✅ Liquidation heatmaps
- ✅ Subscription billing (Stripe)
- ✅ WebSocket real-time updates

---

## Tech Stack

- **Frontend**: TanStack Start, React, Tailwind CSS, shadcn/ui
- **Backend**: Hono, Bun/Node.js, Go
- **Database**: PostgreSQL (Drizzle), ClickHouse, Redis
- **Infrastructure**: Docker, Turborepo, pnpm

---

## Quick Start

```bash
pnpm install
pnpm dev
```

Access:
- Web: http://localhost:3001
- API: http://localhost:3000

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Cloudflare + VPS + Supabase deployment guide.
