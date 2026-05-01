# Phase 3: AI-Managed Copy Trading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered trader recommendation and strategy rebalancing using OpenAI GPT-4o, with human approval workflow.

**Architecture:** Create independent AI recommendation service that calls OpenAI API, parses responses, and stores recommendations. Users approve/reject recommendations through API routes. All decisions are logged.

**Tech Stack:** TypeScript, OpenAI SDK, Drizzle PostgreSQL, Vitest

---

## Scope Check

This plan covers one subsystem: AI recommendation and approval workflow. It does not include auto-apply mode, risk questionnaire, or market sentiment analysis. The spec at `docs/superpowers/specs/2026-04-28-phase3-ai-management-design.md` is the source of truth.

## File Structure

- Create: `apps/api-gateway/src/services/ai-recommendations.ts` — OpenAI integration, prompt construction, response parsing
- Create: `apps/api-gateway/src/services/ai-recommendations.test.ts` — prompt and parsing tests
- Modify: `packages/database/postgres/src/schema.ts` — add `aiRecommendations` table
- Modify: `packages/database/postgres/src/migrate-trader-stats.ts` — add migration
- Modify: `apps/api-gateway/src/routes/copy.ts` — replace mock recommendations with real AI service
- Modify: `apps/api-gateway/package.json` — add `openai` dependency

---

### Task 1: Database Schema for AI Recommendations

**Files:**
- Modify: `packages/database/postgres/src/schema.ts`
- Modify: `packages/database/postgres/src/migrate-trader-stats.ts`

- [ ] **Step 1: Add aiRecommendations table to schema**

In `packages/database/postgres/src/schema.ts`, add after `copyPositions`:

```ts
export const aiRecommendations = pgTable(
  'ai_recommendations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    strategyId: uuid('strategy_id')
      .references(() => copyStrategies.id, { onDelete: 'set null' }),

    // Recommendation type
    type: text('type').notNull(), // 'trader_selection', 'weight_rebalance', 'leverage_adjustment'

    // Input data snapshot
    inputData: jsonb('input_data').notNull(),

    // AI output
    recommendations: jsonb('recommendations').notNull(),
    reasoning: text('reasoning').notNull(),
    confidence: decimal('confidence', { precision: 5, scale: 2 }).notNull(),

    // Status
    status: text('status').default('pending').notNull(), // 'pending', 'approved', 'rejected', 'applied'

    // User decision
    reviewedAt: timestamp('reviewed_at'),
    reviewNotes: text('review_notes'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('idx_ai_recommendations_user_id').on(table.userId),
    strategyIdIdx: index('idx_ai_recommendations_strategy_id').on(table.strategyId),
    statusIdx: index('idx_ai_recommendations_status').on(table.status),
  }),
);
```

Add type exports near existing exports:

```ts
export type AiRecommendation = typeof aiRecommendations.$inferSelect;
export type NewAiRecommendation = typeof aiRecommendations.$inferInsert;
```

- [ ] **Step 2: Add migration SQL**

In `packages/database/postgres/src/migrate-trader-stats.ts`, after the `trader_positions` creation block, add:

```ts
// Create ai_recommendations table
await client`
  CREATE TABLE IF NOT EXISTS ai_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id uuid REFERENCES copy_strategies(id) ON DELETE SET NULL,
    type text NOT NULL,
    input_data jsonb NOT NULL,
    recommendations jsonb NOT NULL,
    reasoning text NOT NULL,
    confidence numeric(5, 2) NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    reviewed_at timestamp,
    review_notes text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
`;
console.log('✅ ai_recommendations table created');

await client`CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_id ON ai_recommendations(user_id);`;
await client`CREATE INDEX IF NOT EXISTS idx_ai_recommendations_strategy_id ON ai_recommendations(strategy_id);`;
await client`CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status ON ai_recommendations(status);`;
```

- [ ] **Step 3: Run type-check**

Run: `pnpm exec tsc packages/database/postgres/src/schema.ts --noEmit --skipLibCheck`
Expected: exits 0

- [ ] **Step 4: Commit**

```bash
git add packages/database/postgres/src/schema.ts packages/database/postgres/src/migrate-trader-stats.ts
git commit -m "feat(database): add ai_recommendations schema"
```

---

### Task 2: OpenAI Integration Service

**Files:**
- Create: `apps/api-gateway/src/services/ai-recommendations.ts`
- Create: `apps/api-gateway/src/services/ai-recommendations.test.ts`
- Modify: `apps/api-gateway/package.json`

- [ ] **Step 1: Add openai dependency**

In `apps/api-gateway/package.json`, add to `dependencies`:

```json
"openai": "^4.0.0"
```

Run: `pnpm install`

- [ ] **Step 2: Write failing prompt construction test**

Create `apps/api-gateway/src/services/ai-recommendations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildRecommendationPrompt, parseAiResponse } from './ai-recommendations';

describe('ai-recommendations', () => {
  describe('buildRecommendationPrompt', () => {
    it('builds a prompt with trader data and constraints', () => {
      const prompt = buildRecommendationPrompt({
        traders: [
          {
            traderId: 'trader-1',
            address: '0x1234',
            pnl7d: 5000,
            pnl30d: 15000,
            winrate: 65,
            totalTrades: 100,
            equityUsd: 100000,
            maxDrawdown: 10,
            sharpeRatio: 1.5,
            isActive: true,
          },
        ],
        positions: [
          {
            traderId: 'trader-1',
            symbol: 'BTC',
            side: 'long',
            quantity: 0.5,
            positionValueUsd: 25000,
            unrealizedPnl: 500,
          },
        ],
        currentStrategy: null,
        constraints: {
          maxLeverage: 5,
          maxPositionUsd: 10000,
          riskTolerance: 'moderate',
        },
      });

      expect(prompt).toContain('trader-1');
      expect(prompt).toContain('BTC');
      expect(prompt).toContain('5000');
      expect(prompt).toContain('moderate');
    });
  });

  describe('parseAiResponse', () => {
    it('parses a valid AI response', () => {
      const response = JSON.stringify({
        traders: [
          {
            traderId: 'trader-1',
            reason: 'Strong PnL and winrate',
            confidence: 0.85,
            suggestedWeight: 0.5,
          },
        ],
        overallReasoning: 'Diversified portfolio with strong performer',
        riskAssessment: 'Moderate risk with good upside',
      });

      const result = parseAiResponse(response);

      expect(result.traders).toHaveLength(1);
      expect(result.traders[0].traderId).toBe('trader-1');
      expect(result.traders[0].confidence).toBe(0.85);
    });

    it('throws on invalid JSON', () => {
      expect(() => parseAiResponse('invalid')).toThrow();
    });

    it('throws on missing required fields', () => {
      const response = JSON.stringify({ traders: [] });
      expect(() => parseAiResponse(response)).toThrow();
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/ai-recommendations.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement AI recommendations service**

Create `apps/api-gateway/src/services/ai-recommendations.ts`:

```ts
import OpenAI from 'openai';

export interface TraderData {
  traderId: string;
  address: string;
  pnl7d: number;
  pnl30d: number;
  winrate: number;
  totalTrades: number;
  equityUsd: number;
  maxDrawdown: number;
  sharpeRatio: number;
  isActive: boolean;
}

export interface PositionData {
  traderId: string;
  symbol: string;
  side: string;
  quantity: number;
  positionValueUsd: number;
  unrealizedPnl: number;
}

export interface UserConstraints {
  maxLeverage: number;
  maxPositionUsd: number;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}

export interface RecommendationInput {
  traders: TraderData[];
  positions: PositionData[];
  currentStrategy: any | null;
  constraints: UserConstraints;
}

export interface TraderRecommendation {
  traderId: string;
  reason: string;
  confidence: number;
  suggestedWeight: number;
}

export interface AiRecommendationOutput {
  traders: TraderRecommendation[];
  overallReasoning: string;
  riskAssessment: string;
}

export function buildRecommendationPrompt(input: RecommendationInput): string {
  const traderSummaries = input.traders
    .map(
      (t) =>
        `- ${t.traderId} (${t.address}): PnL 7d=$${t.pnl7d}, 30d=$${t.pnl30d}, WinRate=${t.winrate}%, Trades=${t.totalTrades}, Equity=$${t.equityUsd}, MaxDD=${t.maxDrawdown}%, Sharpe=${t.sharpeRatio}, Active=${t.isActive}`,
    )
    .join('\n');

  const positionSummaries = input.positions
    .map(
      (p) =>
        `- ${p.traderId}: ${p.side} ${p.quantity} ${p.symbol} ($${p.positionValueUsd}, PnL=$${p.unrealizedPnl})`,
    )
    .join('\n');

  const strategyInfo = input.currentStrategy
    ? `Current strategy: ${JSON.stringify(input.currentStrategy)}`
    : 'No existing strategy.';

  return `You are a Hyperliquid copy trading advisor. Analyze the following trader data and provide recommendations.

## Available Traders
${traderSummaries}

## Current Trader Positions
${positionSummaries || 'No open positions.'}

## ${strategyInfo}

## User Constraints
- Max Leverage: ${input.constraints.maxLeverage}
- Max Position Size: $${input.constraints.maxPositionUsd}
- Risk Tolerance: ${input.constraints.riskTolerance}

Provide recommendations in JSON format:
{
  "traders": [
    {
      "traderId": "uuid",
      "reason": "Why this trader is recommended",
      "confidence": 0.85,
      "suggestedWeight": 0.3
    }
  ],
  "overallReasoning": "Overall strategy explanation",
  "riskAssessment": "Risk analysis of the recommendation"
}`;
}

export function parseAiResponse(response: string): AiRecommendationOutput {
  const parsed = JSON.parse(response);

  if (!parsed.traders || !Array.isArray(parsed.traders)) {
    throw new Error('Invalid response: missing traders array');
  }

  if (!parsed.overallReasoning || typeof parsed.overallReasoning !== 'string') {
    throw new Error('Invalid response: missing overallReasoning');
  }

  if (!parsed.riskAssessment || typeof parsed.riskAssessment !== 'string') {
    throw new Error('Invalid response: missing riskAssessment');
  }

  for (const trader of parsed.traders) {
    if (!trader.traderId || typeof trader.traderId !== 'string') {
      throw new Error('Invalid trader: missing traderId');
    }
    if (typeof trader.confidence !== 'number' || trader.confidence < 0 || trader.confidence > 1) {
      throw new Error('Invalid trader: confidence must be 0-1');
    }
    if (typeof trader.suggestedWeight !== 'number' || trader.suggestedWeight < 0 || trader.suggestedWeight > 1) {
      throw new Error('Invalid trader: suggestedWeight must be 0-1');
    }
  }

  return parsed as AiRecommendationOutput;
}

export async function getAiRecommendations(input: RecommendationInput): Promise<AiRecommendationOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const openai = new OpenAI({ apiKey });
  const prompt = buildRecommendationPrompt(input);

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  return parseAiResponse(content);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/ai-recommendations.test.ts`
Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api-gateway/package.json apps/api-gateway/src/services/ai-recommendations.ts apps/api-gateway/src/services/ai-recommendations.test.ts pnpm-lock.yaml
git commit -m "feat(api-gateway): add AI recommendation service"
```

---

### Task 3: API Routes for Recommendations

**Files:**
- Modify: `apps/api-gateway/src/routes/copy.ts`

- [ ] **Step 1: Read current copy.ts to understand structure**

Read the file to find the existing mock `recommendations` route.

- [ ] **Step 2: Replace mock recommendations route**

Find the `recommendations` route (currently returns mock data). Replace with:

```ts
recommendations: protectedProcedure
  .input(
    z.object({
      strategyId: z.string().optional(),
      riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate'),
    }),
  )
  .query(async ({ input, ctx }) => {
    const userId = ctx.user!.userId;

    // Get top traders
    const topTraders = await db
      .select({
        traderId: traderStats.traderId,
        address: traderStats.address,
        pnl7d: traderStats.pnl7d,
        pnl30d: traderStats.pnl30d,
        winrate: traderStats.winrate,
        totalTrades: traderStats.totalTrades,
        equityUsd: traderStats.equityUsd,
        maxDrawdown: traderStats.maxDrawdown,
        sharpeRatio: traderStats.sharpeRatio,
      })
      .from(traderStats)
      .where(sql`${traderStats.lastTradeAt} > NOW() - INTERVAL '7 days'`)
      .orderBy(desc(traderStats.pnl7d))
      .limit(50);

    // Get current positions for top traders
    const traderIds = topTraders.map((t) => t.traderId);
    const positions = await db
      .select()
      .from(traderPositions)
      .where(sql`${traderPositions.traderId} = ANY(${traderIds})`);

    // Get current strategy if specified
    let currentStrategy = null;
    if (input.strategyId) {
      const strategies = await db
        .select()
        .from(copyStrategies)
        .where(and(eq(copyStrategies.id, input.strategyId), eq(copyStrategies.userId, userId)))
        .limit(1);
      currentStrategy = strategies[0] || null;
    }

    // Call AI service
    const recommendation = await getAiRecommendations({
      traders: topTraders.map((t) => ({
        ...t,
        pnl7d: Number(t.pnl7d || 0),
        pnl30d: Number(t.pnl30d || 0),
        winrate: Number(t.winrate || 0),
        totalTrades: t.totalTrades || 0,
        equityUsd: Number(t.equityUsd || 0),
        maxDrawdown: Number(t.maxDrawdown || 0),
        sharpeRatio: Number(t.sharpeRatio || 0),
        isActive: true,
      })),
      positions: positions.map((p) => ({
        traderId: p.traderId,
        symbol: p.symbol,
        side: p.side,
        quantity: Number(p.quantity),
        positionValueUsd: Number(p.positionValueUsd),
        unrealizedPnl: Number(p.unrealizedPnl || 0),
      })),
      currentStrategy,
      constraints: {
        maxLeverage: Number(currentStrategy?.maxLeverage || 5),
        maxPositionUsd: Number(currentStrategy?.maxPositionUsd || 10000),
        riskTolerance: input.riskTolerance,
      },
    });

    // Store recommendation
    const [row] = await db
      .insert(aiRecommendations)
      .values({
        userId,
        strategyId: input.strategyId || null,
        type: 'trader_selection',
        inputData: {
          traders: topTraders,
          positions,
          currentStrategy,
          constraints: { riskTolerance: input.riskTolerance },
        },
        recommendations: recommendation.traders,
        reasoning: recommendation.overallReasoning,
        confidence: (recommendation.traders.reduce((sum, t) => sum + t.confidence, 0) / recommendation.traders.length).toString(),
        status: 'pending',
      })
      .returning();

    return {
      id: row.id,
      traders: recommendation.traders,
      overallReasoning: recommendation.overallReasoning,
      riskAssessment: recommendation.riskAssessment,
      status: row.status,
      createdAt: row.createdAt,
    };
  }),
```

Add imports at top of copy.ts:

```ts
import { getAiRecommendations } from '../services/ai-recommendations';
import { aiRecommendations } from '@hyperdash/database';
import { traderPositions } from '@hyperdash/database';
import { sql, desc } from 'drizzle-orm';
```

- [ ] **Step 3: Add approve/reject mutations**

Add to copy.ts router:

```ts
approveRecommendation: protectedProcedure
  .input(z.object({ recommendationId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user!.userId;

    const [recommendation] = await db
      .select()
      .from(aiRecommendations)
      .where(and(eq(aiRecommendations.id, input.recommendationId), eq(aiRecommendations.userId, userId)))
      .limit(1);

    if (!recommendation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Recommendation not found' });
    if (recommendation.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Recommendation already reviewed' });

    // Apply recommendations to strategy if strategyId exists
    if (recommendation.strategyId) {
      const recommendations = recommendation.recommendations as any[];
      for (const rec of recommendations) {
        // Update or create allocation
        const [existing] = await db
          .select()
          .from(copyAllocations)
          .where(and(
            eq(copyAllocations.strategyId, recommendation.strategyId),
            eq(copyAllocations.traderId, rec.traderId),
          ))
          .limit(1);

        if (existing) {
          await db
            .update(copyAllocations)
            .set({ weight: rec.suggestedWeight.toString() })
            .where(eq(copyAllocations.id, existing.id));
        } else {
          await db.insert(copyAllocations).values({
            strategyId: recommendation.strategyId,
            traderId: rec.traderId,
            weight: rec.suggestedWeight.toString(),
            status: 'active',
          });
        }
      }
    }

    // Update recommendation status
    await db
      .update(aiRecommendations)
      .set({ status: 'approved', reviewedAt: new Date() })
      .where(eq(aiRecommendations.id, input.recommendationId));

    return { success: true, message: 'Recommendation approved and applied' };
  }),

rejectRecommendation: protectedProcedure
  .input(z.object({ recommendationId: z.string(), notes: z.string().optional() }))
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user!.userId;

    const [recommendation] = await db
      .select()
      .from(aiRecommendations)
      .where(and(eq(aiRecommendations.id, input.recommendationId), eq(aiRecommendations.userId, userId)))
      .limit(1);

    if (!recommendation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Recommendation not found' });
    if (recommendation.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Recommendation already reviewed' });

    await db
      .update(aiRecommendations)
      .set({ status: 'rejected', reviewedAt: new Date(), reviewNotes: input.notes })
      .where(eq(aiRecommendations.id, input.recommendationId));

    return { success: true, message: 'Recommendation rejected' };
  }),
```

- [ ] **Step 4: Run type-check**

Run: `pnpm exec tsc apps/api-gateway/src/routes/copy.ts --noEmit --skipLibCheck`
Expected: exits 0 or only pre-existing errors

- [ ] **Step 5: Commit**

```bash
git add apps/api-gateway/src/routes/copy.ts
git commit -m "feat(api-gateway): add AI recommendation routes"
```

---

### Task 4: Final Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run all API tests**

Run: `pnpm --filter @hyperdash/api-gateway test`
Expected: All tests pass

- [ ] **Step 2: Run type-check**

Run: `pnpm type-check`
Expected: Only pre-existing errors

- [ ] **Step 3: Run build**

Run: `pnpm --filter web build`
Expected: Vite build passes

- [ ] **Step 4: Commit verification fixes if any**

If any command required source changes, commit them:

```bash
git add <changed-files>
git commit -m "fix: stabilize Phase 3 verification"
```

---

## Self-Review

- **Spec coverage:** OpenAI integration, prompt construction, response parsing, recommendation storage, approve/reject workflow, decision logging — all covered.
- **Placeholder scan:** No TBD/TODO found.
- **Type consistency:** `buildRecommendationPrompt`, `parseAiResponse`, `getAiRecommendations` signatures match throughout.
- **Scope:** Phase 3 only. Auto-apply mode and risk questionnaire excluded.
