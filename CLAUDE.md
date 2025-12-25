# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Package Manager & Build

- **Package Manager**: `pnpm@9.15.0` (workspace monorepo)
- **Build Orchestration**: Turborepo
- **Linting/Formatting**: Biome (not ESLint/Prettier)

### Common Commands

```bash
# Development
pnpm dev              # Start web + api-gateway
pnpm dev:web          # Start web only
pnpm dev:api          # Start api-gateway only

# Building
pnpm build            # Build all
turbo run build --filter=web  # Build specific app

# Code Quality
pnpm lint             # Biome check
pnpm lint:fix         # Biome auto-fix
pnpm format           # Biome format
pnpm type-check       # TypeScript check across workspace

# Database
pnpm db:migrate       # Run PostgreSQL migrations

# Docker (infrastructure)
pnpm docker:up        # Start Postgres + Redis
pnpm docker:down      # Stop Docker services

# Tests
pnpm test             # Run all tests via Turborepo
```

---

## Architecture

**This is a copy trading platform for Hyperliquid exchange.** Core functionality: discover traders, create copy strategies, auto-execute trades via Go engine.

### Monorepo Structure (Turborepo + pnpm)

```
apps/                      # Deployable services
├── web/                   # TanStack Start frontend (Vite, port 5173)
├── api-gateway/           # Express + tRPC API (port 3000)
└── copy-engine/           # Go trading engine (port 3006)

packages/                  # Shared workspace dependencies
├── database/              # Drizzle schemas (PostgreSQL + Redis)
├── shared-types/          # Shared TypeScript types
└── contracts/             # API contracts/routers
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | TanStack Start, Vite, React 18, Tailwind CSS 4, RainbowKit (wallet) |
| Backend API | Express, tRPC, TypeScript |
| Trading Engine | Go 1.21+ |
| Database | PostgreSQL (Drizzle ORM) |
| Cache | Redis |
| Auth | JWT + wallet signatures |

### Key Architectural Patterns

1. **API Gateway**: Uses **tRPC** (not Hono) with Express adapter. Routers defined in `src/routes/` are combined into `appRouter`.
2. **Database Package**: `@hyperdash/database` exports Drizzle schemas and `migrate` script. Migrations are in `packages/database/postgres/`.
3. **Workspace Dependencies**: Use `workspace:*` in package.json for internal links.
4. **Web Routes**: File-based routing via TanStack Router (`routes/` directory). Root layout has nav: Dashboard, Traders, Strategies.
5. **WebSocket**: Separate WebSocketServer class in `api-gateway/src/lib/websocket.ts` for real-time updates.

---

## Core Features

1. **Trader Discovery** (`routes/traders/`) - Browse and analyze traders on Hyperliquid
2. **Copy Trading** (`routes/strategies/`) - Create copy strategies with risk controls
3. **Trade Execution** (`copy-engine/`) - Go engine that executes copied trades

---

## Environment Variables

Root `.env.example` is the source of truth. Key variables:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hyperdash
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key

# Hyperliquid API
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz/info
HYPERLIQUID_WS_URL=wss://api.hyperliquid.xyz/ws

# Ports
WEB_PORT=5173
API_PORT=3000
COPY_ENGINE_PORT=3006
```

---

## Code Style

- **Formatter**: Biome (`pnpm format` before committing)
- **Linting**: Biome (`pnpm lint`)
- **TypeScript**: Strict mode enabled across workspace

---

## Database

- **PostgreSQL**: Transactional data via Drizzle ORM
- **Redis**: Caching layer
- Migrations: `pnpm db:migrate` (PostgreSQL only, in `packages/database/postgres/`)

---

## API Routes (api-gateway)

Located in `apps/api-gateway/src/routes/`:
- `auth.ts` - Authentication (JWT + wallet signatures)
- `traders.ts` - Trader profiles and metrics
- `copy.ts` - Copy trading strategies
- `user.ts` - User management
- `system.ts` - Health checks and system info

All routes are combined in `routes/index.ts` and exported as `appRouter` for tRPC.
