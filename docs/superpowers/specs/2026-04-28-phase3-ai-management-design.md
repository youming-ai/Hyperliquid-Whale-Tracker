# Phase 3: AI-Managed Copy Trading Design

## Goal

Add AI-powered trader recommendation and strategy rebalancing to the copy trading platform. The AI analyzes trader performance and position data to recommend optimal trader combinations and allocation weights, with human approval required before changes take effect.

## Scope

Phase 3 builds on Phase 1 (tracking) and Phase 2 (real execution) and adds:

- OpenAI GPT-4o integration for trader analysis and recommendation generation.
- AI recommendation service that evaluates traders and suggests strategy parameters.
- Human approval workflow for AI recommendations.
- Decision logging with input data, reasoning, and confidence scores.
- Strategy rebalancing based on AI recommendations.

**Out of scope:** Auto-apply mode, risk profile questionnaire, dynamic stop-loss, market sentiment analysis, chain data integration.

## Architecture

### Component Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Frontend   │───►│   API Gateway    │───►│  OpenAI API     │
│  (Approve/Reject │    │  (ai-recommendations│  │  (GPT-4o)       │
│   Recommendations)│   │   .ts)           │    └─────────────────┘
└─────────────────┘    └──────────────────┘
                              │
                       ┌──────────────┐
                       │  PostgreSQL  │
                       └──────────────┘
```

### New Modules

| Module | File | Responsibility |
|--------|------|----------------|
| AI Recommendations | `apps/api-gateway/src/services/ai-recommendations.ts` | OpenAI integration, recommendation generation |
| AI Decision Logger | `apps/api-gateway/src/services/ai-decision-logger.ts` | Log AI decisions with reasoning |

### Modified Modules

| Module | Change |
|--------|--------|
| `apps/api-gateway/src/routes/copy.ts` | Replace mock recommendations with real AI service |
| `packages/database/postgres/src/schema.ts` | Add `aiRecommendations` table |
| `packages/database/postgres/src/migrate-trader-stats.ts` | Add migration for new table |

### Database Schema

#### aiRecommendations Table

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

## AI Recommendation Service

### Input Data

The AI receives a structured prompt containing:

1. **User's current strategy** (if exists): name, mode, risk params, current allocations
2. **Available traders**: top 50 ranked by PnL with stats (equity, PnL 7d/30d, winrate, Sharpe, max drawdown, total trades, active status)
3. **Current positions**: each trader's open positions (symbol, side, quantity, PnL)
4. **User constraints**: max leverage, max position size, risk tolerance

### Prompt Structure

```
You are a Hyperliquid copy trading advisor. Analyze the following trader data and provide recommendations.

## Available Traders
[JSON array of trader stats]

## Current Trader Positions
[JSON array of positions per trader]

## User Strategy (if exists)
[Current strategy config]

## User Constraints
- Max Leverage: X
- Max Position Size: $X
- Risk Tolerance: conservative/moderate/aggressive

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
}
```

### Output Processing

1. Parse JSON response from OpenAI
2. Validate all trader IDs exist in database
3. Validate weights sum to 1.0 (portfolio mode) or are 1.0 (single trader mode)
4. Store recommendation in `ai_recommendations` table
5. Return recommendation to frontend for user review

## User Workflow

### Request Recommendations

1. User clicks "Get AI Recommendations" on strategy page
2. Frontend calls `copy.getRecommendations` mutation
3. Backend gathers trader data, sends to OpenAI
4. AI returns recommendations with reasoning
5. Backend stores recommendation with status `pending`
6. Frontend displays recommendation with approve/reject buttons

### Approve Recommendations

1. User clicks "Approve" on recommendation
2. Frontend calls `copy.approveRecommendation` mutation
3. Backend updates recommendation status to `approved`
4. Backend applies changes to strategy:
   - Updates allocation weights
   - Updates risk params if suggested
5. Backend logs the decision to audit_logs

### Reject Recommendations

1. User clicks "Reject" on recommendation
2. Frontend calls `copy.rejectRecommendation` mutation
3. Backend updates recommendation status to `rejected`
4. No changes applied to strategy

## Decision Logging

Every AI recommendation is logged with:

```ts
{
  recommendationId: string;
  inputData: {
    traders: TraderStats[];
    positions: TraderPositions[];
    currentStrategy: CopyStrategy | null;
    userConstraints: UserConstraints;
  };
  output: {
    recommendations: Recommendation[];
    reasoning: string;
    confidence: number;
  };
  userDecision: 'pending' | 'approved' | 'rejected' | 'applied';
  appliedChanges: {
    allocationsUpdated: boolean;
    riskParamsUpdated: boolean;
  } | null;
}
```

## Error Handling

| Error | Handling |
|-------|----------|
| OpenAI API failure | Return error to frontend, log to audit |
| Invalid JSON response | Retry once, then return error |
| Invalid trader IDs | Filter out invalid IDs, log warning |
| Weights don't sum to 1 | Normalize weights, log adjustment |
| Rate limit exceeded | Queue request, return "try again later" |

## Environment Variables

```bash
# New
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_MODEL=gpt-4o  # default, configurable

# Existing
DATABASE_URL=postgresql://...
```

## Testing

Phase 3 adds focused unit tests for:

- Prompt construction with trader data
- Response parsing and validation
- Weight normalization
- Decision logging

Integration tests use OpenAI test API key.

## Acceptance Criteria

Phase 3 is complete when:

- User can request AI recommendations from strategy page
- AI returns trader recommendations with reasoning and confidence
- User can approve or reject recommendations
- Approved recommendations update strategy allocations
- All recommendations are logged in `ai_recommendations` table
- Decision logs include input data, output, and user decision
- No API keys are exposed in logs or responses

## Production Readiness Checklist

Before deploying to production:

- [ ] `OPENAI_API_KEY` is set and secured
- [ ] OpenAI rate limiting handled gracefully
- [ ] Recommendation quality validated on historical data
- [ ] User approval workflow tested end-to-end
- [ ] Decision logs reviewed for completeness
- [ ] No API keys in logs, errors, or API responses
- [ ] Cost monitoring for OpenAI API usage
