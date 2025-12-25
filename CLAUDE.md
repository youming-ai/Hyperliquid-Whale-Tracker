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
pnpm dev                    # Start web + api-gateway
pnpm dev:web                # Start web only (TanStack Start/Vite)
pnpm dev:api                # Start api-gateway only

# Building
pnpm build                  # Build all packages and apps
turbo run build --filter=web  # Build specific app

# Code Quality
pnpm lint                   # Biome check
pnpm lint:fix               # Biome auto-fix
pnpm format                 # Biome format
pnpm type-check             # TypeScript check across workspace

# Database
pnpm db:migrate             # Run PostgreSQL + ClickHouse migrations

# Docker
pnpm docker:up              # Start infrastructure (Postgres, ClickHouse, Redis, Kafka)
pnpm docker:down            # Stop Docker services

# Tests
pnpm test                   # Run all tests via Turborepo
```

---

## Architecture

### Monorepo Structure (Turborepo + pnpm)

```
apps/                      # Services (independent deployments)
├── web/                   # TanStack Start frontend (Vite, port 5173/3001)
├── api-gateway/           # Hono API (Bun/Node.js, port 3000)
├── data-ingestion/        # Market data ingestion (port 3003)
├── analytics/             # Analytics service (port 3004)
├── billing/               # Stripe billing (port 3005)
└── copy-engine/           # Go trading engine (port 3006)

packages/                  # Shared workspace dependencies
├── ui/                    # coss UI components (@hyperdash/ui)
├── shared-types/          # Shared TypeScript types
├── database/              # Drizzle schemas (PostgreSQL + ClickHouse)
└── contracts/             # API contracts/routers
```

### Tech Stack Notes

| Layer | Technology |
|-------|------------|
| Frontend | TanStack Start (not Next.js), Vite, React 18, Tailwind CSS 4 |
| Backend | Hono (not Express/tRPC), Bun runtime preferred |
| UI Components | coss UI (@hyperdash/ui), not shadcn/ui |
| ORM | Drizzle ORM |
| Databases | PostgreSQL (transactional), ClickHouse (analytics/time-series), Redis (cache) |
| Message Queue | Kafka (via docker-compose for local) |
| Trading Engine | Go 1.21+ |

### Key Architectural Patterns

1. **Workspace Dependencies**: Use `workspace:*` in package.json for internal links
2. **Database Package**: `@hyperdash/database` exports Drizzle schemas for both PostgreSQL and ClickHouse
3. **UI Package**: `@hyperdash/ui` uses path exports for components and lib utilities
4. **Shared Types**: `@hyperdash/shared-types` for cross-service type safety

---

## Environment Variables

- Root `.env.example` contains all variables
- Service-specific `.env` files inherit from root
- Key services use different ports: web (5173/3001), api-gateway (3000), ingestion (3003), analytics (3004), billing (3005), copy-engine (3006)

---

## Code Style

- **Formatter**: Biome (run `pnpm format` before committing)
- **Linting**: Biome (run `pnpm lint` to check)
- **TypeScript**: Strict mode enabled across workspace

---

## Database

- **PostgreSQL**: Transactional data via Drizzle ORM
- **ClickHouse**: Time-series analytics data
- **Redis**: Caching layer
- Migrations run via `pnpm db:migrate` (handles both Postgres and ClickHouse)

---

## Deployment Configuration

| Target | Config |
|--------|--------|
| Local Docker | `docker-compose.yml` |
| Cloudflare + VPS + Supabase | `docs/DEPLOYMENT.md` |
| Dokploy (VPS) | `dokploy.json` |
| Cloudflare Workers | `cloudflare/workers/wrangler.toml` |
| Supabase | `supabase/config.toml` |
