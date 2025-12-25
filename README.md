# HyperDash Platform

Data intelligence and copy trading platform for the Hyperliquid derivatives ecosystem.

## Tech Stack

- **Frontend**: TanStack Start, Vite, React, TypeScript, Tailwind CSS
- **Backend**: Hono, Bun/Node.js, Go (copy engine)
- **Database**: PostgreSQL (Drizzle ORM), ClickHouse, Redis
- **Package Manager**: pnpm workspaces
- **Build Tool**: Turborepo
- **Linting**: Biome

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Access
# Web: http://localhost:5173
# API: http://localhost:3000
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web + api-gateway |
| `pnpm dev:web` | Start web only |
| `pnpm dev:api` | Start api-gateway only |
| `pnpm build` | Build all packages/apps |
| `pnpm lint` | Run Biome linter |
| `pnpm format` | Format code |
| `pnpm type-check` | TypeScript type checking |
| `pnpm db:migrate` | Run database migrations |
| `pnpm docker:up` | Start Docker services |
| `pnpm docker:down` | Stop Docker services |

## Project Structure

```
├── apps/
│   ├── web/            # TanStack Start frontend (Vite)
│   ├── api-gateway/    # Hono API gateway
│   ├── data-ingestion/ # Market data service
│   ├── analytics/      # Analytics service
│   ├── billing/        # Stripe billing
│   └── copy-engine/    # Go trading engine
├── packages/
│   ├── ui/             # Shared UI components (coss UI)
│   ├── shared-types/   # TypeScript types
│   ├── database/       # Drizzle schemas
│   └── contracts/      # API contracts
└── docs/               # Documentation
```

## Deployment

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for Cloudflare + VPS + Supabase deployment guide.

## Environment

Copy `.env.example` to `.env` and configure:
- Database URLs (PostgreSQL, ClickHouse, Redis)
- JWT secrets
- Hyperliquid API keys
- Stripe keys (billing)
