# HyperDash Platform

Data intelligence and copy trading platform for Hyperliquid derivatives ecosystem.

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│     Web     │◄──►│ API Gateway │◄──►│ Copy Engine │
│  (TanStack) │    │   (Hono)    │    │    (Go)     │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
                   ┌──────────────┐
                   │  PostgreSQL  │
                   │  ClickHouse  │
                   │    Redis     │
                   └──────────────┘
```

## Tech Stack

- **Frontend**: TanStack Start, Vite, React, TypeScript, Tailwind CSS
- **Backend**: Hono, Bun/Node.js
- **Trading Engine**: Go
- **Database**: PostgreSQL (Drizzle ORM), ClickHouse, Redis
- **Build**: Turborepo, pnpm workspaces
- **Linting**: Biome

## Apps

| App | Description | Port |
|-----|-------------|------|
| `web` | TanStack Start frontend | 5173 |
| `api-gateway` | Hono API | 3000 |
| `copy-engine` | Go trading engine | 3006 |

## Packages

| Package | Description |
|---------|-------------|
| `shared-types` | TypeScript types |
| `database` | Drizzle schemas (PostgreSQL + ClickHouse) |
| `contracts` | API contracts |

## Quick Start

```bash
# Install dependencies
pnpm install

# Start infrastructure (Postgres, ClickHouse, Redis)
pnpm docker:up

# Run migrations
pnpm db:migrate

# Start development
pnpm dev

# Access
# Web: http://localhost:5173
# API: http://localhost:3000
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web + api |
| `pnpm build` | Build all |
| `pnpm lint` | Biome check |
| `pnpm format` | Format code |
| `pnpm type-check` | TypeScript check |
| `pnpm db:migrate` | Database migrations |
| `pnpm docker:up` | Start Docker services |

## Project Structure

```
├── apps/
│   ├── web/            # Frontend
│   ├── api-gateway/    # API
│   └── copy-engine/    # Trading engine
├── packages/
│   ├── shared-types/   # Types
│   ├── database/       # Schemas
│   └── contracts/      # API contracts
├── docs/               # Documentation
└── docker-compose.yml  # Infrastructure
```

## Environment

Copy `.env.example` to `.env` and configure:
- Database URLs
- JWT secrets
- Hyperliquid API keys
