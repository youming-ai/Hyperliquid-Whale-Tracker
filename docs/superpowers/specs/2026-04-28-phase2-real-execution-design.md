# Phase 2: Real Hyperliquid Order Execution Design

## Goal

Replace paper order generation with real Hyperliquid order submission, enabling users' copy strategies to execute actual trades on the exchange.

## Scope

Phase 2 builds on Phase 1's paper execution loop and adds:

- Agent wallet generation and encrypted private key storage.
- Hyperliquid Exchange API adapter for order placement and cancellation.
- Real order submission replacing the current paper `executeTrades` implementation.
- Fill reconciliation via polling.
- Basic safety controls: daily loss limit, max order size, strategy kill switch.
- Audit logging for every order decision.

**Out of scope:** AI management, advanced risk controls, Go engine, WebSocket real-time fills.

## Architecture

### Component Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Web Frontend   │───►│   API Gateway    │───►│  Hyperliquid API    │
│  (Agent Wallet   │    │  (copy-engine.ts │    │  /exchange endpoint │
│   Onboarding)    │    │  + exchange.ts)  │    └─────────────────────┘
└─────────────────┘    └──────────────────┘
                              │
                       ┌──────────────┐
                       │  PostgreSQL  │
                       │    Redis     │
                       └──────────────┘
```

### New Modules

| Module | File | Responsibility |
|--------|------|----------------|
| Exchange Adapter | `apps/api-gateway/src/services/exchange.ts` | Hyperliquid `/exchange` API client with signing |
| Key Management | `apps/api-gateway/src/services/key-management.ts` | AES-GCM encrypt/decrypt private keys |
| Agent Wallet Service | `apps/api-gateway/src/services/agent-wallets.ts` | Wallet generation, onboarding, verification |
| Fill Reconciler | `apps/api-gateway/src/services/fill-reconciler.ts` | Poll for order fills, update DB |
| Safety Controls | `apps/api-gateway/src/services/safety-controls.ts` | Daily loss limit, order size cap, kill switch |

### Modified Modules

| Module | Change |
|--------|--------|
| `apps/api-gateway/src/services/copy-engine.ts` | `executeTrades` calls exchange adapter instead of paper insertion |
| `apps/api-gateway/src/routes/copy.ts` | Add agent wallet onboarding routes |
| `apps/api-gateway/src/routes/copy-control.ts` | Add kill switch endpoint |
| `packages/database/postgres/src/schema.ts` | Add `encryptedPrivateKey` to `agentWallets`, add `auditLogs` table |

## Agent Wallet Onboarding

### Flow

1. User calls `copy.generateAgentWallet` mutation.
2. Server generates a new secp256k1 keypair using `viem/accounts`.
3. Server encrypts the private key with AES-256-GCM using `ENCRYPTION_KEY` env var.
4. Server stores encrypted key + public address in `agent_wallets` table.
5. Server returns the agent wallet address to the frontend.
6. Frontend prompts user to approve the agent wallet on Hyperliquid via their main wallet (RainbowKit `writeContract` calling `HyperliquidMainApproveAgent`).
7. User confirms the on-chain transaction.
8. Frontend calls `copy.verifyAgentApproval` mutation with the transaction hash.
9. Server verifies the approval via Hyperliquid Info API (`postActions` query or checking clearinghouse state).
10. Server updates `agent_wallets.status` to `'active'`.

### Key Generation

```ts
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
// account.address = agent wallet address
```

### Encryption

Use Node.js built-in `crypto` module with AES-256-GCM:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function encryptKey(privateKey: string, encryptionKey: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptKey(encryptedBase64: string, encryptionKey: Buffer): string {
  const data = Buffer.from(encryptedBase64, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}
```

`ENCRYPTION_KEY` is a 32-byte hex string stored in `.env`. If missing, the server refuses to start.

## Hyperliquid Exchange API

### Endpoint

`POST {HYPERLIQUID_EXCHANGE_URL}` (default: `https://api.hyperliquid.xyz/exchange`)

### Request Signing

Every exchange request requires a signed payload. Hyperliquid uses EIP-712 typed data signing:

1. Construct the action object (e.g., `{ type: "order", orders: [...] }`).
2. Sign with the agent wallet's private key using `signTypedData` from `viem`.
3. Send as `{ action, signature, nonce, vaultAddress? }`.

### Order Placement

```ts
interface HyperliquidOrder {
  a: number;    // asset index (from meta.universe)
  b: boolean;   // is_buy
  p: string;    // price ("" for market)
  s: string;    // size
  r: boolean;   // reduce_only
  t: { limit: {} } | { trigger: { triggerPx: string; isMarket: boolean; tpsl: string } };
}

interface ExchangeRequest {
  action: { type: string; orders?: HyperliquidOrder[]; grouping?: string };
  signature: { r: string; s: string; v: number };
  nonce: number;
  vaultAddress?: string;
}
```

### Order Types

Phase 2 supports **market orders only** (limit order with aggressive price). Market orders are placed as limit orders with price at mid * (1 + slippageBps/10000) for buys, mid * (1 - slippageBps/10000) for sells.

### Fill Reconciliation

After order submission, poll `userFillsByTime` to detect fills:

```ts
// Poll every 2 seconds for up to 30 seconds
for (let i = 0; i < 15; i++) {
  const fills = await getUserFillsByTime(address, startTime);
  const orderFills = fills.filter(f => f.oid === orderId);
  if (orderFills.length > 0) {
    // Update copyOrders with fill data
    break;
  }
  await sleep(2000);
}
```

## Database Changes

### agentWallets Table

Add column:

```sql
ALTER TABLE agent_wallets ADD COLUMN encrypted_private_key TEXT;
```

### auditLogs Table

The existing `audit_logs` table from `migrate.ts` is sufficient. Wire it to execution events.

### copyOrders Table

No schema changes needed. The existing `status` field supports `'submitted'`, `'filled'`, `'partial'`, `'failed'`.

## Safety Controls

### Daily Loss Limit

- Per-strategy field: `max_daily_loss_usd` (default: $1000).
- Before each order, check today's realized PnL from `copy_orders.pnl`.
- If cumulative loss exceeds limit, skip order and set strategy status to `'error'`.

### Max Order Size

- Per-strategy field: `max_order_usd` (default: $500).
- Reject any single order where `quantity * markPrice > maxOrderUsd`.

### Strategy Kill Switch

- New endpoint: `copy.killStrategy` mutation.
- Sets `copy_strategies.status = 'terminated'`.
- Engine skips terminated strategies immediately.
- UI button on strategy detail page.

### Audit Logging

Every order decision writes to `audit_logs`:

```ts
{
  actor_id: userId,
  actor_type: 'system',
  action: 'place_order',
  resource_type: 'copy_order',
  resource_id: orderId,
  old_values: null,
  new_values: { symbol, side, quantity, price, status },
  request_context: { strategyId, traderId, reason: 'source_trader_position_change' },
  status: 'success' | 'failure',
  error_message: errorMessage,
}
```

## Error Handling

| Error | Handling |
|-------|----------|
| Private key decryption fails | Log error, skip strategy, set status `'error'` |
| Hyperliquid 429/5xx | Retry with exponential backoff (3 retries) |
| Order rejected by exchange | Mark order `'failed'`, log to audit, continue next delta |
| Fill poll timeout | Mark order `'submitted'` (not filled), reconciler picks up later |
| Daily loss limit hit | Skip order, set strategy `'error'`, log to audit |
| Agent wallet not approved | Skip strategy, log warning |

## Environment Variables

```bash
# New
ENCRYPTION_KEY=<64-char-hex-string>     # AES-256 key for private key encryption
HYPERLIQUID_EXCHANGE_URL=https://api.hyperliquid.xyz/exchange

# Existing (used)
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz/info
```

## Testing

Phase 2 adds focused unit tests for:

- Key encryption/decryption round-trip.
- Order payload construction and signing.
- Safety control limit checks.
- Fill reconciliation state machine.

Integration tests require Hyperliquid testnet (`https://api.hyperliquid-testnet.xyz`).

## Acceptance Criteria

Phase 2 is complete when:

- User can generate an agent wallet via the frontend.
- Agent wallet private key is encrypted in the database.
- User can approve the agent wallet on Hyperliquid (testnet).
- Starting a strategy with an approved agent wallet submits real orders to Hyperliquid testnet.
- Fills are reconciled and `copy_orders` status updates to `'filled'`.
- Daily loss limit prevents orders when exceeded.
- Kill switch immediately stops a strategy.
- All order decisions are logged in `audit_logs`.
- No private keys are stored in plaintext.

## Production Readiness Checklist

Before deploying to production:

- [ ] `ENCRYPTION_KEY` is set and rotated periodically
- [ ] Hyperliquid testnet integration passes end-to-end
- [ ] Agent wallet approval flow tested with real wallet (testnet)
- [ ] Kill switch tested (stops orders immediately)
- [ ] Daily loss limit tested (blocks orders when exceeded)
- [ ] Audit logs reviewed for completeness
- [ ] No private keys in logs, errors, or API responses
- [ ] Rate limiting on exchange API calls
- [ ] Monitoring and alerting for failed orders
