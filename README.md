# HyperDash - Copy Trading Platform

Copy trading platform for Hyperliquid derivatives exchange.

## Features

- **Trader Discovery** - Browse and analyze top traders
- **Copy Trading** - Automatically copy trades from selected traders
- **Strategy Management** - Create and manage copy strategies with risk controls

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│     Web     │◄──►│ API Gateway │◄──►│ Copy Engine │
│  (TanStack) │    │   (Hono)    │    │    (Go)     │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                   ┌──────────────┐
                   │  PostgreSQL  │
                   │    Redis     │
                   └──────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | TanStack Start, React, Tailwind CSS |
| Backend | Hono, Bun |
| Trading Engine | Go |
| Database | PostgreSQL (Drizzle ORM) |
| Cache | Redis |
| Build | Turborepo, pnpm |

## Quick Start

```bash
# Install
pnpm install

# Start infrastructure
pnpm docker:up

# Migrate database
pnpm db:migrate

# Start dev
pnpm dev
```

Web: http://localhost:5173 | API: http://localhost:3000

## Project Structure

```
├── apps/
│   ├── web/           # Frontend (traders, strategies)
│   ├── api-gateway/   # API (auth, traders, copy)
│   └── copy-engine/   # Go trading engine
├── packages/
│   ├── database/      # Drizzle schemas
│   └── contracts/     # API contracts
└── docker-compose.yml
```

## Environment

Copy `.env.example` to `.env`:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hyperdash
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key

# Hyperliquid
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz/info
HYPERLIQUID_WS_URL=wss://api.hyperliquid.xyz/ws
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web + api |
| `pnpm build` | Build all |
| `pnpm lint` | Biome check |
| `pnpm db:migrate` | Migrations |
| `pnpm docker:up` | Start Docker |
