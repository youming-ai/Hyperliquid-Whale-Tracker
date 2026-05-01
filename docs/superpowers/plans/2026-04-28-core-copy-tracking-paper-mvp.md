# Core Copy Tracking Paper MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 MVP: real trader tracking, current positions, real strategy creation, and paper copy-order generation.

**Architecture:** Extend the existing TypeScript API gateway and Drizzle schema. Keep Hyperliquid access inside `services/hyperliquid.ts`, add focused services for trader positions and copy target calculation, and make `copy-engine.ts` generate paper orders and simulated positions only.

**Tech Stack:** pnpm 9, Turborepo, TypeScript, Express tRPC, Drizzle PostgreSQL, TanStack React Query, Vitest for API service tests.

---

## Scope Check

The full product has three subsystems: tracking, real execution, and AI management. This plan implements the first independently testable subsystem: tracking plus paper copy. Real order submission and AI auto-management must be planned separately after this plan passes.

## File Structure

- Modify: `packages/database/postgres/src/schema.ts` to add `traderPositions`.
- Create: `packages/database/postgres/0002_trader_positions.sql` for the database migration.
- Create: `apps/api-gateway/src/config/leaderboard-traders.ts` for the Phase 1 seed list.
- Modify: `apps/api-gateway/src/services/hyperliquid.ts` to export position-row mapping helpers.
- Create: `apps/api-gateway/src/services/trader-positions.ts` to upsert and clear current trader positions.
- Modify: `apps/api-gateway/src/jobs/ingest-traders.ts` to store positions during ingestion.
- Modify: `apps/api-gateway/src/services/traders.ts` to support frontend filter names and positions queries.
- Modify: `apps/api-gateway/src/routes/traders.ts` to expose `positions`.
- Create: `apps/api-gateway/src/services/copy-targets.ts` to calculate target positions from allocations.
- Modify: `apps/api-gateway/src/services/copy-engine.ts` to use `copy-targets` and generate paper orders/positions.
- Modify: `apps/api-gateway/package.json` to add `test` script and `vitest` dev dependency.
- Create: `apps/api-gateway/src/services/copy-targets.test.ts`.
- Create: `apps/api-gateway/src/services/trader-positions.test.ts`.
- Modify: `apps/web/src/routes/traders/index.tsx` to use backend-supported filters.
- Modify: `apps/web/src/routes/traders/$address.tsx` to load current positions.
- Modify: `apps/web/src/routes/strategies/new.tsx` to use real traders and call `copy.createStrategy`.

---

### Task 1: Add Current Trader Positions Schema

**Files:**
- Modify: `packages/database/postgres/src/schema.ts`
- Create: `packages/database/postgres/0002_trader_positions.sql`

- [ ] **Step 1: Add `traderPositions` table to schema**

Insert this table after `traderTrades` in `packages/database/postgres/src/schema.ts`:

```ts
export const traderPositions = pgTable(
  'trader_positions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    traderId: uuid('trader_id')
      .notNull()
      .references(() => traderStats.traderId, { onDelete: 'cascade' }),
    traderAddress: text('trader_address').notNull(),
    symbol: text('symbol').notNull(),
    side: text('side').notNull(),
    quantity: decimal('quantity', { precision: 20, scale: 8 }).notNull(),
    entryPrice: decimal('entry_price', { precision: 20, scale: 8 }).notNull(),
    markPrice: decimal('mark_price', { precision: 20, scale: 8 }).notNull(),
    positionValueUsd: decimal('position_value_usd', { precision: 20, scale: 2 }).notNull(),
    unrealizedPnl: decimal('unrealized_pnl', { precision: 20, scale: 2 }).default('0'),
    marginUsed: decimal('margin_used', { precision: 20, scale: 2 }).default('0'),
    leverage: decimal('leverage', { precision: 8, scale: 2 }).default('1'),
    liquidationPrice: decimal('liquidation_price', { precision: 20, scale: 8 }),
    metadata: jsonb('metadata').default('{}'),
    lastUpdatedAt: timestamp('last_updated_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    traderIdIdx: index('idx_trader_positions_trader_id').on(table.traderId),
    addressIdx: index('idx_trader_positions_address').on(table.traderAddress),
    symbolIdx: index('idx_trader_positions_symbol').on(table.symbol),
    uniquePosition: index('idx_trader_positions_unique').on(
      table.traderId,
      table.symbol,
      table.side,
    ),
  }),
);
```

Update the type exports near the existing trader exports:

```ts
export type TraderPosition = typeof traderPositions.$inferSelect;
export type NewTraderPosition = typeof traderPositions.$inferInsert;
```

- [ ] **Step 2: Add migration SQL**

Create `packages/database/postgres/0002_trader_positions.sql`:

```sql
CREATE TABLE IF NOT EXISTS trader_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id uuid NOT NULL REFERENCES trader_stats(trader_id) ON DELETE CASCADE,
  trader_address text NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL,
  quantity numeric(20, 8) NOT NULL,
  entry_price numeric(20, 8) NOT NULL,
  mark_price numeric(20, 8) NOT NULL,
  position_value_usd numeric(20, 2) NOT NULL,
  unrealized_pnl numeric(20, 2) DEFAULT '0',
  margin_used numeric(20, 2) DEFAULT '0',
  leverage numeric(8, 2) DEFAULT '1',
  liquidation_price numeric(20, 8),
  metadata jsonb DEFAULT '{}',
  last_updated_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trader_positions_trader_id ON trader_positions(trader_id);
CREATE INDEX IF NOT EXISTS idx_trader_positions_address ON trader_positions(trader_address);
CREATE INDEX IF NOT EXISTS idx_trader_positions_symbol ON trader_positions(symbol);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trader_positions_unique ON trader_positions(trader_id, symbol, side);
```

- [ ] **Step 3: Run type-check for database package**

Run: `pnpm --filter @hyperdash/database type-check`

Expected: command exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/database/postgres/src/schema.ts packages/database/postgres/0002_trader_positions.sql
git commit -m "feat(database): add trader positions schema"
```

---

### Task 2: Add Position Mapping and Persistence

**Files:**
- Modify: `apps/api-gateway/src/services/hyperliquid.ts`
- Create: `apps/api-gateway/src/services/trader-positions.ts`
- Modify: `apps/api-gateway/package.json`
- Create: `apps/api-gateway/src/services/trader-positions.test.ts`

- [ ] **Step 1: Add API test tooling**

Modify `apps/api-gateway/package.json` scripts:

```json
"test": "vitest run"
```

Add dev dependency:

```json
"vitest": "^1.6.0"
```

- [ ] **Step 2: Write failing mapper test**

Create `apps/api-gateway/src/services/trader-positions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { HyperliquidAssetPosition } from './hyperliquid';
import { assetPositionToTraderPositionRow } from './hyperliquid';

describe('assetPositionToTraderPositionRow', () => {
  it('maps a long Hyperliquid position into a trader position row', () => {
    const position: HyperliquidAssetPosition = {
      type: 'oneWay',
      position: {
        coin: 'BTC',
        szi: '0.25',
        entryPx: '60000',
        positionValue: '15000',
        unrealizedPnl: '250',
        marginUsed: '3000',
        liquidationPx: '48000',
        returnOnEquity: '0.0833',
        leverage: { type: 'cross', value: 5 },
      },
    };

    const row = assetPositionToTraderPositionRow(position, 'trader-1', '0x1111111111111111111111111111111111111111', '61000');

    expect(row).toMatchObject({
      traderId: 'trader-1',
      traderAddress: '0x1111111111111111111111111111111111111111',
      symbol: 'BTC',
      side: 'long',
      quantity: '0.25',
      entryPrice: '60000',
      markPrice: '61000',
      positionValueUsd: '15000',
      unrealizedPnl: '250',
      marginUsed: '3000',
      leverage: '5',
      liquidationPrice: '48000',
    });
  });

  it('maps a short position with absolute quantity', () => {
    const position: HyperliquidAssetPosition = {
      type: 'oneWay',
      position: {
        coin: 'ETH',
        szi: '-2.5',
        entryPx: '3000',
        positionValue: '7500',
        unrealizedPnl: '-100',
        marginUsed: '1500',
        liquidationPx: null,
        returnOnEquity: '-0.0666',
        leverage: { type: 'cross', value: 5 },
      },
    };

    const row = assetPositionToTraderPositionRow(position, 'trader-1', '0x1111111111111111111111111111111111111111', '2950');

    expect(row.side).toBe('short');
    expect(row.quantity).toBe('2.5');
    expect(row.liquidationPrice).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/trader-positions.test.ts`

Expected: FAIL because `assetPositionToTraderPositionRow` is not exported.

- [ ] **Step 4: Add mapper implementation**

Append to `apps/api-gateway/src/services/hyperliquid.ts`:

```ts
export interface TraderPositionRow {
  traderId: string;
  traderAddress: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: string;
  entryPrice: string;
  markPrice: string;
  positionValueUsd: string;
  unrealizedPnl: string;
  marginUsed: string;
  leverage: string;
  liquidationPrice: string | null;
  metadata: Record<string, unknown>;
  lastUpdatedAt: Date;
}

export function assetPositionToTraderPositionRow(
  assetPosition: HyperliquidAssetPosition,
  traderId: string,
  traderAddress: string,
  markPrice: string,
): TraderPositionRow {
  const position = assetPosition.position;
  const signedSize = Number(position.szi);
  const side: 'long' | 'short' = signedSize >= 0 ? 'long' : 'short';

  return {
    traderId,
    traderAddress,
    symbol: position.coin,
    side,
    quantity: Math.abs(signedSize).toString(),
    entryPrice: position.entryPx,
    markPrice,
    positionValueUsd: position.positionValue,
    unrealizedPnl: position.unrealizedPnl,
    marginUsed: position.marginUsed,
    leverage: String(position.leverage.value),
    liquidationPrice: position.liquidationPx,
    metadata: {
      marginMode: position.leverage.type,
      returnOnEquity: position.returnOnEquity,
    },
    lastUpdatedAt: new Date(),
  };
}
```

- [ ] **Step 5: Add persistence service**

Create `apps/api-gateway/src/services/trader-positions.ts`:

```ts
import { traderPositions } from '@hyperdash/database';
import { and, eq, notInArray } from 'drizzle-orm';
import { getDatabaseConnection } from './connection';
import type { TraderPositionRow } from './hyperliquid';

export async function replaceTraderPositions(
  traderId: string,
  rows: TraderPositionRow[],
): Promise<void> {
  const db = getDatabaseConnection().getDatabase();
  const activeKeys = rows.map((row) => `${row.symbol}:${row.side}`);

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const [existing] = await tx
        .select({ id: traderPositions.id })
        .from(traderPositions)
        .where(
          and(
            eq(traderPositions.traderId, traderId),
            eq(traderPositions.symbol, row.symbol),
            eq(traderPositions.side, row.side),
          ),
        )
        .limit(1);

      if (existing) {
        await tx.update(traderPositions).set(row).where(eq(traderPositions.id, existing.id));
      } else {
        await tx.insert(traderPositions).values(row as any);
      }
    }

    if (activeKeys.length === 0) {
      await tx.delete(traderPositions).where(eq(traderPositions.traderId, traderId));
      return;
    }

    await tx
      .delete(traderPositions)
      .where(
        and(
          eq(traderPositions.traderId, traderId),
          notInArray(
            traderPositions.symbol,
            rows.map((row) => row.symbol),
          ),
        ),
      );
  });
}
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/trader-positions.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api-gateway/package.json apps/api-gateway/src/services/hyperliquid.ts apps/api-gateway/src/services/trader-positions.ts apps/api-gateway/src/services/trader-positions.test.ts
git commit -m "feat(api-gateway): map and persist trader positions"
```

---

### Task 3: Ingest Leaderboard Traders With Positions

**Files:**
- Create: `apps/api-gateway/src/config/leaderboard-traders.ts`
- Modify: `apps/api-gateway/src/jobs/ingest-traders.ts`

- [ ] **Step 1: Create seed list module**

Create `apps/api-gateway/src/config/leaderboard-traders.ts`:

```ts
export interface LeaderboardTraderSeed {
  address: `0x${string}`;
  label?: string;
}

export const LEADERBOARD_TRADER_SEEDS: LeaderboardTraderSeed[] = [
  // Replace these with verified Hyperliquid leaderboard addresses before production ingestion.
];
```

- [ ] **Step 2: Update ingestion imports**

In `apps/api-gateway/src/jobs/ingest-traders.ts`, import the seed list and position helpers:

```ts
import { LEADERBOARD_TRADER_SEEDS } from '../config/leaderboard-traders';
import { assetPositionToTraderPositionRow, getAllMids, getClearinghouseState } from '../services/hyperliquid';
import { replaceTraderPositions } from '../services/trader-positions';
```

- [ ] **Step 3: Replace hard-coded empty addresses**

Replace `KNOWN_WHALE_ADDRESSES` with:

```ts
const KNOWN_WHALE_ADDRESSES = LEADERBOARD_TRADER_SEEDS.map((seed) => seed.address);
```

- [ ] **Step 4: Persist positions after stats upsert**

Inside `ingestTraderAddress`, after the stats row is inserted or updated and `traderId` is known, add:

```ts
const [state, mids] = await Promise.all([
  getClearinghouseState(address).catch(() => null),
  getAllMids().catch(() => ({})),
]);

const positionRows =
  state?.assetPositions
    .filter((assetPosition) => Number(assetPosition.position.szi) !== 0)
    .map((assetPosition) =>
      assetPositionToTraderPositionRow(
        assetPosition,
        traderId,
        address,
        mids[assetPosition.position.coin] ?? assetPosition.position.entryPx,
      ),
    ) ?? [];

await replaceTraderPositions(traderId, positionRows);
```

- [ ] **Step 5: Run type-check**

Run: `pnpm --filter @hyperdash/api-gateway type-check`

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api-gateway/src/config/leaderboard-traders.ts apps/api-gateway/src/jobs/ingest-traders.ts
git commit -m "feat(api-gateway): ingest leaderboard trader positions"
```

---

### Task 4: Expose Trader Positions and Compatible Ranking Filters

**Files:**
- Modify: `apps/api-gateway/src/services/traders.ts`
- Modify: `apps/api-gateway/src/routes/traders.ts`

- [ ] **Step 1: Update supported filter types**

In `apps/api-gateway/src/services/traders.ts`, extend types:

```ts
export type Timeframe = '7d' | '30d' | '90d' | 'all';
export type SortBy = 'pnl' | 'winrate' | 'winRate' | 'trades' | 'sharpe' | 'equity';
```

Normalize inputs at the top of `getTraders`:

```ts
const normalizedSortBy = sortBy === 'winRate' ? 'winrate' : sortBy;
const normalizedTimeframe = timeframe === '90d' ? '30d' : timeframe;
```

Use `normalizedSortBy` and `normalizedTimeframe` in sort column selection.

- [ ] **Step 2: Add positions query service**

Add to `apps/api-gateway/src/services/traders.ts`:

```ts
import { traderPositions } from '@hyperdash/database';

export async function getTraderPositions(address: string) {
  const db = getDatabaseConnection().getDatabase();

  return db
    .select()
    .from(traderPositions)
    .where(eq(traderPositions.traderAddress, address))
    .orderBy(desc(traderPositions.positionValueUsd));
}
```

- [ ] **Step 3: Add `positions` route**

In `apps/api-gateway/src/routes/traders.ts`, add:

```ts
positions: publicProcedure
  .input(
    z.object({
      address: z.string().length(42),
    }),
  )
  .query(async ({ input }) => {
    const positions = await traderService.getTraderPositions(input.address);

    return positions.map((position) => ({
      id: position.id,
      symbol: position.symbol,
      side: position.side,
      quantity: Number(position.quantity),
      entryPrice: Number(position.entryPrice),
      markPrice: Number(position.markPrice),
      positionValueUsd: Number(position.positionValueUsd),
      unrealizedPnl: Number(position.unrealizedPnl || 0),
      marginUsed: Number(position.marginUsed || 0),
      leverage: Number(position.leverage || 1),
      liquidationPrice: position.liquidationPrice ? Number(position.liquidationPrice) : null,
      lastUpdatedAt: position.lastUpdatedAt?.toISOString() ?? null,
    }));
  }),
```

- [ ] **Step 4: Run type-check**

Run: `pnpm --filter @hyperdash/api-gateway type-check`

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api-gateway/src/services/traders.ts apps/api-gateway/src/routes/traders.ts
git commit -m "feat(api-gateway): expose trader positions"
```

---

### Task 5: Calculate Copy Target Positions

**Files:**
- Create: `apps/api-gateway/src/services/copy-targets.ts`
- Create: `apps/api-gateway/src/services/copy-targets.test.ts`

- [ ] **Step 1: Write failing target calculation test**

Create `apps/api-gateway/src/services/copy-targets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateCopyTargets } from './copy-targets';

describe('calculateCopyTargets', () => {
  it('scales source exposure by allocation weight and strategy capital', () => {
    const targets = calculateCopyTargets({
      strategy: { maxPositionUsd: 10_000, maxLeverage: 5, minOrderUsd: 25 },
      allocations: [{ traderId: 'trader-1', weight: 0.5 }],
      traders: [{ traderId: 'trader-1', equityUsd: 100_000 }],
      sourcePositions: [
        {
          traderId: 'trader-1',
          symbol: 'BTC',
          side: 'long',
          quantity: 1,
          markPrice: 50_000,
          positionValueUsd: 50_000,
        },
      ],
    });

    expect(targets).toEqual([
      {
        symbol: 'BTC',
        side: 'long',
        targetQuantity: 0.05,
        targetNotionalUsd: 2500,
      },
    ]);
  });

  it('drops targets below minimum order size', () => {
    const targets = calculateCopyTargets({
      strategy: { maxPositionUsd: 100, maxLeverage: 3, minOrderUsd: 25 },
      allocations: [{ traderId: 'trader-1', weight: 0.1 }],
      traders: [{ traderId: 'trader-1', equityUsd: 100_000 }],
      sourcePositions: [
        {
          traderId: 'trader-1',
          symbol: 'ETH',
          side: 'long',
          quantity: 1,
          markPrice: 3000,
          positionValueUsd: 3000,
        },
      ],
    });

    expect(targets).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/copy-targets.test.ts`

Expected: FAIL because `copy-targets.ts` does not exist.

- [ ] **Step 3: Implement target calculation**

Create `apps/api-gateway/src/services/copy-targets.ts`:

```ts
export interface CopyTargetStrategyInput {
  maxPositionUsd: number;
  maxLeverage: number;
  minOrderUsd: number;
}

export interface CopyTargetAllocationInput {
  traderId: string;
  weight: number;
}

export interface CopyTargetTraderInput {
  traderId: string;
  equityUsd: number;
}

export interface CopyTargetSourcePositionInput {
  traderId: string;
  symbol: string;
  side: string;
  quantity: number;
  markPrice: number;
  positionValueUsd: number;
}

export interface CopyTargetPosition {
  symbol: string;
  side: 'long' | 'short';
  targetQuantity: number;
  targetNotionalUsd: number;
}

export function calculateCopyTargets(input: {
  strategy: CopyTargetStrategyInput;
  allocations: CopyTargetAllocationInput[];
  traders: CopyTargetTraderInput[];
  sourcePositions: CopyTargetSourcePositionInput[];
}): CopyTargetPosition[] {
  const tradersById = new Map(input.traders.map((trader) => [trader.traderId, trader]));
  const aggregate = new Map<string, CopyTargetPosition>();

  for (const allocation of input.allocations) {
    const trader = tradersById.get(allocation.traderId);
    if (!trader || trader.equityUsd <= 0) continue;

    const allocationCapital = input.strategy.maxPositionUsd * allocation.weight;
    const positions = input.sourcePositions.filter(
      (position) => position.traderId === allocation.traderId && position.markPrice > 0,
    );

    for (const position of positions) {
      const exposureRatio = position.positionValueUsd / trader.equityUsd;
      const rawNotional = allocationCapital * exposureRatio;
      const maxLeveredNotional = allocationCapital * input.strategy.maxLeverage;
      const targetNotionalUsd = Math.min(rawNotional, maxLeveredNotional);
      if (targetNotionalUsd < input.strategy.minOrderUsd) continue;

      const side = position.side === 'short' ? 'short' : 'long';
      const key = `${position.symbol}:${side}`;
      const existing = aggregate.get(key);
      const targetQuantity = targetNotionalUsd / position.markPrice;

      if (existing) {
        existing.targetQuantity += targetQuantity;
        existing.targetNotionalUsd += targetNotionalUsd;
      } else {
        aggregate.set(key, {
          symbol: position.symbol,
          side,
          targetQuantity,
          targetNotionalUsd,
        });
      }
    }
  }

  return Array.from(aggregate.values());
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/copy-targets.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api-gateway/src/services/copy-targets.ts apps/api-gateway/src/services/copy-targets.test.ts
git commit -m "feat(api-gateway): calculate copy target positions"
```

---

### Task 6: Generate Paper Orders From Copy Engine

**Files:**
- Modify: `apps/api-gateway/src/services/copy-engine.ts`

- [ ] **Step 1: Import target calculator and position tables**

Add imports:

```ts
import { calculateCopyTargets } from './copy-targets';
```

- [ ] **Step 2: Replace placeholder `calculateTargetPositions`**

Replace the body of `calculateTargetPositions` in `apps/api-gateway/src/services/copy-engine.ts` with database-backed inputs:

```ts
const traderIds = allocations.map((allocation) => allocation.traderId);

const traders = await this.db
  .select({
    traderId: schema.traderStats.traderId,
    equityUsd: schema.traderStats.equityUsd,
  })
  .from(schema.traderStats)
  .where(sql`${schema.traderStats.traderId} = ANY(${traderIds})`);

const sourcePositions = await this.db
  .select()
  .from(schema.traderPositions)
  .where(sql`${schema.traderPositions.traderId} = ANY(${traderIds})`);

const targets = calculateCopyTargets({
  strategy: {
    maxPositionUsd: Number(strategy.maxPositionUsd || 10_000),
    maxLeverage: Number(strategy.maxLeverage || 3),
    minOrderUsd: Number(strategy.minOrderUsd || 5),
  },
  allocations: allocations.map((allocation) => ({
    traderId: allocation.traderId,
    weight: Number(allocation.weight),
  })),
  traders: traders.map((trader) => ({
    traderId: trader.traderId,
    equityUsd: Number(trader.equityUsd || 0),
  })),
  sourcePositions: sourcePositions.map((position) => ({
    traderId: position.traderId,
    symbol: position.symbol,
    side: position.side,
    quantity: Number(position.quantity),
    markPrice: Number(position.markPrice),
    positionValueUsd: Number(position.positionValueUsd),
  })),
});

const targetPositions = new Map<string, { quantity: number; side: string }>();
for (const target of targets) {
  targetPositions.set(`${target.symbol}:${target.side}`, {
    quantity: target.targetQuantity,
    side: target.side,
  });
}

return targetPositions;
```

- [ ] **Step 3: Fix delta calculation signature**

`calculatePositionDeltas` currently references an unavailable `strategy`. Add a `minOrderUsd` parameter and call it from `processStrategy`:

```ts
const deltas = this.calculatePositionDeltas(
  currentPositions,
  targetPositions,
  Number(strategy.minOrderUsd || 5),
);
```

Update the method signature:

```ts
private calculatePositionDeltas(
  current: Map<string, { quantity: number; side: string }>,
  target: Map<string, { quantity: number; side: string }>,
  minOrderSize: number,
): PositionDelta[] {
```

Remove the local line:

```ts
const minOrderSize = Number(strategy?.minOrderUsd || 5);
```

- [ ] **Step 4: Mark generated orders as paper submitted**

In `executeTrades`, insert orders with metadata and `submittedAt`:

```ts
await this.db.insert(schema.copyOrders).values({
  userId: strategy.userId,
  strategyId: strategy.id,
  agentWalletId: strategy.agentWalletId,
  exchange: 'hyperliquid',
  symbol: delta.symbol,
  side: delta.action,
  orderType: 'market',
  quantity: Math.abs(delta.delta).toString(),
  status: 'submitted',
  submittedAt: new Date(),
  errorMessage: null,
} as any);
```

- [ ] **Step 5: Run API type-check**

Run: `pnpm --filter @hyperdash/api-gateway type-check`

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api-gateway/src/services/copy-engine.ts
git commit -m "feat(api-gateway): generate paper copy orders"
```

---

### Task 7: Wire Web Trader and Strategy Pages to Real API

**Files:**
- Modify: `apps/web/src/routes/traders/index.tsx`
- Modify: `apps/web/src/routes/traders/$address.tsx`
- Modify: `apps/web/src/routes/strategies/new.tsx`

- [ ] **Step 1: Fix trader list query parameters**

In `apps/web/src/routes/traders/index.tsx`, change types:

```ts
type Timeframe = '7d' | '30d' | 'all';
type SortBy = 'pnl' | 'winrate' | 'trades' | 'sharpe';
```

Change query input:

```ts
const { data, isLoading } = trpc.traders.list.useQuery({
  limit: 20,
  sortBy,
  sortOrder,
  timeframe,
  isActive: showActiveOnly,
});
```

Remove the `90D` button and replace `winRate` button state with `winrate`.

- [ ] **Step 2: Load positions on trader detail**

In `apps/web/src/routes/traders/$address.tsx`, add a positions query near the existing trader query:

```ts
const { address } = Route.useParams();
const { data: positions = [] } = trpc.traders.positions.useQuery({ address });
```

Render positions with this table:

```tsx
<section className="mt-8">
  <h2 className="text-xl font-semibold mb-4">Current Positions</h2>
  {positions.length === 0 ? (
    <div className="text-sm opacity-60">No open positions.</div>
  ) : (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left">Symbol</th>
            <th className="px-4 py-3 text-left">Side</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Value</th>
            <th className="px-4 py-3 text-right">PnL</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position: any) => (
            <tr key={position.id} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{position.symbol}</td>
              <td className="px-4 py-3 capitalize">{position.side}</td>
              <td className="px-4 py-3 text-right">{position.quantity}</td>
              <td className="px-4 py-3 text-right">${position.positionValueUsd.toLocaleString()}</td>
              <td className="px-4 py-3 text-right">${position.unrealizedPnl.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</section>
```

- [ ] **Step 3: Replace mock trader selection in new strategy page**

In `apps/web/src/routes/strategies/new.tsx`, remove `mockTopTraders` and use:

```ts
const { data: topTraders = [] } = trpc.traders.list.useQuery({
  limit: 20,
  sortBy: 'pnl',
  sortOrder: 'desc',
  timeframe: '7d',
  isActive: true,
});

const createStrategy = trpc.copy.createStrategy.useMutation({
  onSuccess: () => navigate({ to: '/strategies' }),
});
```

Replace submit body with:

```ts
await createStrategy.mutateAsync({
  name: formData.name,
  description: formData.description || undefined,
  mode: formData.mode,
  riskParams: formData.riskParams,
  settings: formData.settings,
  allocations: formData.allocations,
});
```

When adding allocations, use `trader.traderId` from the API response. If the list route does not yet return `traderId`, add it in `apps/api-gateway/src/routes/traders.ts` list response.

- [ ] **Step 4: Run web build**

Run: `pnpm --filter web build`

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/traders/index.tsx apps/web/src/routes/traders/\$address.tsx apps/web/src/routes/strategies/new.tsx apps/api-gateway/src/routes/traders.ts
git commit -m "feat(web): use real trader data for copy setup"
```

---

### Task 8: Final Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run API tests**

Run: `pnpm --filter @hyperdash/api-gateway test`

Expected: all tests pass.

- [ ] **Step 2: Run type-check**

Run: `pnpm type-check`

Expected: all workspace type checks pass.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`

Expected: Biome exits 0.

- [ ] **Step 4: Run build**

Run: `pnpm build`

Expected: all packages build.

- [ ] **Step 5: Commit verification fixes if any**

If any command required source changes, commit them:

```bash
git add <changed-files>
git commit -m "fix: stabilize paper copy MVP verification"
```

---

## Self-Review

- Spec coverage: Phase 1 tracking, positions, strategy creation, paper target orders, and no real order submission are covered.
- Scope boundary: Real Hyperliquid execution and AI management are intentionally excluded from this plan and require separate specs/plans after Phase 1 verification.
- Placeholder scan: Implementation steps include concrete file paths, code snippets, commands, and expected results.
- Type consistency: Plan consistently uses `traderPositions`, `calculateCopyTargets`, `replaceTraderPositions`, and `assetPositionToTraderPositionRow`.
