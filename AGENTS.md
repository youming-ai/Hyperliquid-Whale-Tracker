# Repository Guidelines

## Project Structure

This is a Turborepo + pnpm monorepo for a Hyperliquid copy trading platform.

```
apps/
  web/              # TanStack Start frontend (Vite, port 5173)
  api-gateway/      # Express + tRPC API (port 3000)
  copy-engine/      # Go trading engine (port 3006)
packages/
  database/         # Drizzle ORM schemas, migrations
  shared-types/     # Shared TypeScript types
  contracts/        # API contracts / tRPC routers
```

Internal workspace dependencies use `workspace:*` in `package.json`.

## Build, Test & Development

| Command | What it does |
|---------|--------------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start web + API gateway concurrently |
| `pnpm dev:web` | Start web app only |
| `pnpm dev:api` | Start API gateway only |
| `pnpm build` | Build all packages/apps |
| `pnpm test` | Run all Vitest suites via Turborepo |
| `pnpm type-check` | TypeScript `--noEmit` across workspace |
| `pnpm lint` | Biome check |
| `pnpm lint:fix` | Biome auto-fix |
| `pnpm format` | Biome format write |
| `pnpm db:migrate` | Run PostgreSQL migrations |
| `pnpm docker:up` | Start Postgres + Redis containers |

## Coding Style & Naming

- **Formatter/Linter**: Biome (no ESLint/Prettier).
- **Indent**: 2 spaces.
- **Quotes**: Single for JS/TS, double for JSX.
- **Trailing commas**: All.
- **Line width**: 100.
- **Semicolons**: Always.
- **Arrow parens**: Always.
- **Imports**: Organize imports enabled in Biome.
- Use TypeScript strict mode. Avoid `any` when possible.

## Testing

- **Framework**: Vitest.
- **Test files**: `*.test.ts` alongside source (e.g., `src/services/foo.test.ts`).
- **Run**: `pnpm test` (all workspaces) or `pnpm vitest run` inside an app/package.
- Aim to cover services and utility logic. UI tests are sparse; prefer integration-level coverage for tRPC routers.

## Commit & Pull Request Guidelines

- **Commit format**: `type(scope): description`
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
  - Example: `feat(api-gateway): add AI recommendation routes`
  - Example: `fix(api-gateway): harden AI recommendation service`
- **PRs**: Use feature branches (`feature/phase2-real-execution`, `feature/phase3-ai-management`). Include a clear description of changes.

## Architecture Notes

- **API Gateway**: tRPC with Express adapter. Routers live in `apps/api-gateway/src/routes/` and are combined into `appRouter` in `src/routes/index.ts`.
- **Web**: File-based routing via TanStack Router (`apps/web/routes/`).
- **Database**: PostgreSQL via Drizzle ORM, Redis for caching. Migrations in `packages/database/postgres/`.
- **WebSocket**: Real-time updates via `api-gateway/src/lib/websocket.ts`.
- **Copy Engine**: Go 1.21+ service that executes copied trades.

## Environment

Copy `.env.example` to `.env` and fill in secrets. Key variables:

- `DATABASE_URL`, `REDIS_URL`
- `JWT_SECRET`
- `HYPERLIQUID_API_URL`, `HYPERLIQUID_WS_URL`
- `WEB_PORT=5173`, `API_PORT=3000`, `COPY_ENGINE_PORT=3006`

## Agent-Specific Instructions

- Do not introduce ESLint or Prettier; the repo uses Biome exclusively.
- Do not replace tRPC with Hono or REST; the API gateway is tRPC-first.
- Use existing workspace packages rather than duplicating types/schemas.
- For frontend, follow TanStack Router file-based conventions in `apps/web/routes/`.
