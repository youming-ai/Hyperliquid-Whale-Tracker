# Core Copy Trading and AI Management Design

## Goal

Build the core product around three capabilities:

1. Track Hyperliquid leaderboard traders' trades and current positions.
2. Let users create copy-trading strategies and follow selected traders.
3. Let an AI risk manager recommend and, with explicit controls, adjust copy-trading settings.

## Scope

This spec separates the work into three deliverable phases so each phase can ship and be verified independently.

### Phase 1: Trader Tracking and Paper Copy MVP

Phase 1 builds the safe core loop:

- Maintain a configured set of leaderboard trader addresses.
- Ingest each trader's recent fills and current Hyperliquid perp positions.
- Store current trader positions separately from historical fills.
- Expose traders, fills, positions, and derived rankings through the API.
- Let authenticated users create strategies and allocations from real trader IDs.
- Generate paper copy orders from source trader positions and strategy risk settings.
- Do not submit real Hyperliquid orders in this phase.

This phase proves the data model, ranking, target-position math, strategy UX, and observability without risking user funds.

### Phase 2: Real Copy Execution

Phase 2 replaces paper execution with real Hyperliquid order submission after explicit production readiness checks:

- Agent wallet onboarding and permissions.
- Hyperliquid signing and exchange adapter.
- Order submission, fill reconciliation, retry policy, and idempotency.
- Kill switch and per-strategy trading limits.
- Audit log for every order decision.

### Phase 3: AI-Managed Copy Trading

Phase 3 adds AI management on top of the verified data and execution loop:

- Risk profile questionnaire and strategy constraints.
- AI recommendations for trader selection, allocation weights, leverage, max position size, and pause/resume decisions.
- Human approval mode by default.
- Optional auto-apply mode only within hard user-defined limits.
- Decision logs that explain input data, recommendation, confidence, and applied changes.

## Architecture

### Data Sources

Use Hyperliquid Info API as the primary source:

- `userFills` for trader trade history.
- `clearinghouseState` for current positions and account equity.
- `allMids` and `meta` for price and asset metadata.

For leaderboard membership, Phase 1 uses a repository-managed seed list in `apps/api-gateway/src/config/leaderboard-traders.ts`. The application ranks those traders from ingested stats. If a stable official Hyperliquid leaderboard endpoint is later confirmed, it can replace or supplement the seed list behind the same interface.

### Backend Units

- `apps/api-gateway/src/services/hyperliquid.ts` remains the low-level Info API client.
- `apps/api-gateway/src/services/trader-ingestion.ts` owns ingestion orchestration for one trader and batches.
- `apps/api-gateway/src/services/trader-positions.ts` maps `clearinghouseState.assetPositions` into database rows.
- `apps/api-gateway/src/services/copy-targets.ts` calculates target copy positions from source positions, allocations, and strategy risk settings.
- `apps/api-gateway/src/services/copy-engine.ts` remains the TypeScript execution loop for Phase 1 paper orders.
- `apps/api-gateway/src/routes/traders.ts` exposes trader rankings, fills, and positions.
- `apps/api-gateway/src/routes/copy.ts` exposes strategy CRUD, paper orders, and strategy status.

The Go copy-engine remains out of Phase 1 because the current API gateway already owns strategy CRUD and database access. Consolidating on one execution loop avoids duplicated, divergent engines while the product is still validating behavior.

### Database Model

Add current trader positions:

- `trader_positions`
- Keyed by `trader_id`, `symbol`, and `side`.
- Stores quantity, entry price, mark price, notional value, unrealized PnL, leverage, liquidation price, and last update time.

Existing tables continue to be used:

- `trader_stats` for ranking metrics.
- `trader_trades` for fills.
- `copy_strategies` and `copy_allocations` for user strategy config.
- `copy_orders` for paper copy order records in Phase 1.
- `copy_positions` for simulated copied positions in Phase 1.

### Copy Math

For each active allocation:

1. Fetch source trader current positions from `trader_positions`.
2. Compute allocation capital as `strategy.maxPositionUsd * allocation.weight`.
3. Compute source exposure ratio as `sourcePosition.positionValue / sourceTrader.equityUsd`.
4. Compute target notional as `allocationCapital * sourceExposureRatio`.
5. Clamp target notional by `strategy.maxPositionUsd` and `strategy.maxLeverage`.
6. Convert notional to target quantity using mark price.
7. Aggregate by symbol and side across allocations.
8. Compare with current copied positions and emit paper order deltas above `minOrderUsd`.

Phase 1 writes paper orders with `status = submitted` and metadata indicating `executionMode = paper`. It also upserts simulated copy positions so alignment and PnL views have data.

### AI Management

AI management depends on trustworthy tracking and strategy state. Phase 1 only reserves the interface shape:

- `ai_recommendations` table in a later phase.
- `copy.aiRecommendations` route in a later phase.
- Recommendations can read trader stats, trader positions, strategy settings, strategy performance, and user constraints.

AI does not directly submit trades. It proposes strategy parameter changes. Auto-apply, when enabled later, can only change fields inside user-defined bounds.

## Error Handling

- Hyperliquid 429/5xx/network errors retry with existing client backoff.
- Invalid trader addresses fail ingestion for that address and continue the batch.
- Empty fills are allowed; empty positions clear current `trader_positions` for that trader.
- Copy target calculation skips source positions with missing mark price, zero equity, or notional below strategy minimum.
- Paper execution records failed orders with `status = failed` and `errorMessage` rather than throwing away the decision.

## Testing

Phase 1 should add focused unit tests for:

- Mapping Hyperliquid positions to database rows.
- Copy target calculation from source positions and allocation weights.
- Paper order generation and idempotency for repeated engine cycles.
- API parameter compatibility for trader list filters.

Verification commands:

- `pnpm --filter @hyperdash/api-gateway test`
- `pnpm type-check`
- `pnpm lint`

## Acceptance Criteria

Phase 1 is complete when:

- Running trader ingestion stores both fills and current positions for seeded leaderboard traders.
- `traders.list` returns ranked real database rows using supported frontend filter values.
- `traders.positions` returns current positions for a trader address.
- The web trader detail page can display current positions from the API.
- The new strategy page uses real traders from the API and creates a real strategy through tRPC.
- Starting a strategy causes the paper copy engine to generate copy orders and simulated copy positions.
- No real Hyperliquid orders are submitted.
