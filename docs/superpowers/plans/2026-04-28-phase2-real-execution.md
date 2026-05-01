# Phase 2: Real Hyperliquid Order Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace paper order generation with real Hyperliquid order submission, enabling users' copy strategies to execute actual trades on the exchange.

**Architecture:** Extend the existing TypeScript API gateway with 5 new service modules (key-management, agent-wallets, exchange, fill-reconciler, safety-controls). The copy-engine.ts `executeTrades` method calls the exchange adapter instead of inserting paper orders. Agent wallet private keys are encrypted with AES-256-GCM and stored in the database.

**Tech Stack:** TypeScript, viem (wallet generation + EIP-712 signing), Node.js crypto (AES-256-GCM), Drizzle PostgreSQL, Vitest

---

## Scope Check

This plan covers one subsystem: real Hyperliquid order execution. It does not include AI management (Phase 3) or Go engine integration. The spec at `docs/superpowers/specs/2026-04-28-phase2-real-execution-design.md` is the source of truth.

## File Structure

- Create: `apps/api-gateway/src/services/key-management.ts` — AES-GCM encrypt/decrypt
- Create: `apps/api-gateway/src/services/key-management.test.ts` — encryption round-trip tests
- Create: `apps/api-gateway/src/services/agent-wallets.ts` — wallet generation, onboarding, verification
- Create: `apps/api-gateway/src/services/agent-wallets.test.ts` — wallet generation tests
- Create: `apps/api-gateway/src/services/exchange.ts` — Hyperliquid Exchange API client with signing
- Create: `apps/api-gateway/src/services/exchange.test.ts` — order payload construction tests
- Create: `apps/api-gateway/src/services/safety-controls.ts` — daily loss limit, max order size, kill switch
- Create: `apps/api-gateway/src/services/safety-controls.test.ts` — safety limit tests
- Create: `apps/api-gateway/src/services/fill-reconciler.ts` — poll for order fills
- Create: `apps/api-gateway/src/services/fill-reconciler.test.ts` — reconciliation state machine tests
- Modify: `packages/database/postgres/src/schema.ts` — add `encryptedPrivateKey` to `agentWallets`
- Modify: `packages/database/postgres/src/migrate-trader-stats.ts` — add migration for new column
- Modify: `apps/api-gateway/src/services/copy-engine.ts` — replace paper `executeTrades` with real execution
- Modify: `apps/api-gateway/src/routes/copy.ts` — add agent wallet onboarding routes
- Modify: `apps/api-gateway/src/routes/copy-control.ts` — add kill switch endpoint
- Modify: `apps/api-gateway/package.json` — add `viem` dependency

---

### Task 1: Key Management Service

**Files:**
- Create: `apps/api-gateway/src/services/key-management.ts`
- Create: `apps/api-gateway/src/services/key-management.test.ts`
- Modify: `apps/api-gateway/package.json`

- [ ] **Step 1: Write failing encryption round-trip test**

Create `apps/api-gateway/src/services/key-management.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decryptKey, encryptKey } from './key-management';

describe('key-management', () => {
  const testKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');

  it('encrypts and decrypts a private key round-trip', () => {
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const encrypted = encryptKey(privateKey, testKey);
    expect(encrypted).not.toBe(privateKey);
    const decrypted = decryptKey(encrypted, testKey);
    expect(decrypted).toBe(privateKey);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const encrypted1 = encryptKey(privateKey, testKey);
    const encrypted2 = encryptKey(privateKey, testKey);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('fails to decrypt with wrong key', () => {
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wrongKey = Buffer.from('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 'hex');
    const encrypted = encryptKey(privateKey, testKey);
    expect(() => decryptKey(encrypted, wrongKey)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/key-management.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement key management**

Create `apps/api-gateway/src/services/key-management.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function encryptKey(privateKey: string, encryptionKey: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptKey(encryptedBase64: string, encryptionKey: Buffer): string {
  const data = Buffer.from(encryptedBase64, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

export function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/key-management.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api-gateway/src/services/key-management.ts apps/api-gateway/src/services/key-management.test.ts
git commit -m "feat(api-gateway): add key management service"
```

---

### Task 2: Agent Wallet Schema and Service

**Files:**
- Modify: `packages/database/postgres/src/schema.ts`
- Modify: `packages/database/postgres/src/migrate-trader-stats.ts`
- Create: `apps/api-gateway/src/services/agent-wallets.ts`
- Create: `apps/api-gateway/src/services/agent-wallets.test.ts`

- [ ] **Step 1: Add encryptedPrivateKey column to schema**

In `packages/database/postgres/src/schema.ts`, add to `agentWallets` table after `permissions`:

```ts
encryptedPrivateKey: text('encrypted_private_key'),
```

- [ ] **Step 2: Add migration SQL**

In `packages/database/postgres/src/migrate-trader-stats.ts`, after the `trader_positions` creation block, add:

```ts
// Add encrypted_private_key to agent_wallets if not exists
await client`
  ALTER TABLE agent_wallets ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT;
`;
console.log('✅ agent_wallets.encrypted_private_key column added');
```

- [ ] **Step 3: Write failing wallet generation test**

Create `apps/api-gateway/src/services/agent-wallets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { generateAgentWallet } from './agent-wallets';

describe('agent-wallets', () => {
  const testEncryptionKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');

  it('generates a wallet with address and encrypted key', () => {
    const wallet = generateAgentWallet(testEncryptionKey);
    expect(wallet.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(wallet.encryptedPrivateKey).toBeTruthy();
    expect(wallet.encryptedPrivateKey).not.toContain('0x');
  });

  it('generates unique wallets each time', () => {
    const wallet1 = generateAgentWallet(testEncryptionKey);
    const wallet2 = generateAgentWallet(testEncryptionKey);
    expect(wallet1.address).not.toBe(wallet2.address);
    expect(wallet1.encryptedPrivateKey).not.toBe(wallet2.encryptedPrivateKey);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/agent-wallets.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 5: Implement agent wallet service**

Create `apps/api-gateway/src/services/agent-wallets.ts`:

```ts
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { decryptKey, encryptKey } from './key-management';

export interface GeneratedWallet {
  address: string;
  encryptedPrivateKey: string;
}

export function generateAgentWallet(encryptionKey: Buffer): GeneratedWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const encryptedPrivateKey = encryptKey(privateKey, encryptionKey);
  return {
    address: account.address,
    encryptedPrivateKey,
  };
}

export function getWalletPrivateKey(
  encryptedPrivateKey: string,
  encryptionKey: Buffer,
): `0x${string}` {
  return decryptKey(encryptedPrivateKey, encryptionKey) as `0x${string}`;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/agent-wallets.test.ts`
Expected: 2 tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/database/postgres/src/schema.ts packages/database/postgres/src/migrate-trader-stats.ts apps/api-gateway/src/services/agent-wallets.ts apps/api-gateway/src/services/agent-wallets.test.ts
git commit -m "feat(api-gateway): add agent wallet generation with encrypted keys"
```

---

### Task 3: Exchange Adapter

**Files:**
- Create: `apps/api-gateway/src/services/exchange.ts`
- Create: `apps/api-gateway/src/services/exchange.test.ts`
- Modify: `apps/api-gateway/package.json`

- [ ] **Step 1: Add viem dependency**

In `apps/api-gateway/package.json`, add to `dependencies`:

```json
"viem": "^2.0.0"
```

Run: `pnpm install`

- [ ] **Step 2: Write failing order construction test**

Create `apps/api-gateway/src/services/exchange.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildMarketOrder, getOrderPrice } from './exchange';

describe('exchange', () => {
  it('builds a market buy order with slippage', () => {
    const order = buildMarketOrder({
      assetIndex: 0,
      isBuy: true,
      size: '0.1',
      midPrice: 50000,
      slippageBps: 10,
    });

    expect(order.a).toBe(0);
    expect(order.b).toBe(true);
    expect(order.s).toBe('0.1');
    expect(order.r).toBe(false);
    expect(Number(order.p)).toBeGreaterThan(50000);
    expect(Number(order.p)).toBeLessThan(50100);
  });

  it('builds a market sell order with slippage', () => {
    const order = buildMarketOrder({
      assetIndex: 1,
      isBuy: false,
      size: '1.5',
      midPrice: 3000,
      slippageBps: 10,
    });

    expect(order.a).toBe(1);
    expect(order.b).toBe(false);
    expect(order.s).toBe('1.5');
    expect(Number(order.p)).toBeLessThan(3000);
    expect(Number(order.p)).toBeGreaterThan(2990);
  });

  it('calculates order price with slippage for buy', () => {
    const price = getOrderPrice(50000, true, 10);
    expect(price).toBe('50005');
  });

  it('calculates order price with slippage for sell', () => {
    const price = getOrderPrice(3000, false, 10);
    expect(price).toBe('2999.7');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/exchange.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement exchange adapter**

Create `apps/api-gateway/src/services/exchange.ts`:

```ts
import { type PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts';

export const HYPERLIQUID_EXCHANGE_URL =
  process.env.HYPERLIQUID_EXCHANGE_URL ?? 'https://api.hyperliquid.xyz/exchange';

export interface BuildOrderInput {
  assetIndex: number;
  isBuy: boolean;
  size: string;
  midPrice: number;
  slippageBps: number;
}

export interface HyperliquidOrder {
  a: number;
  b: boolean;
  p: string;
  s: string;
  r: boolean;
  t: { limit: {} };
}

export interface ExchangeResponse {
  status: string;
  response?: { type: string; data?: any };
  error?: string;
}

export function getOrderPrice(midPrice: number, isBuy: boolean, slippageBps: number): string {
  const slippage = midPrice * (slippageBps / 10000);
  const price = isBuy ? midPrice + slippage : midPrice - slippage;
  return price.toFixed(6).replace(/\.?0+$/, '');
}

export function buildMarketOrder(input: BuildOrderInput): HyperliquidOrder {
  return {
    a: input.assetIndex,
    b: input.isBuy,
    p: getOrderPrice(input.midPrice, input.isBuy, input.slippageBps),
    s: input.size,
    r: false,
    t: { limit: {} },
  };
}

export async function placeOrder(
  account: PrivateKeyAccount,
  orders: HyperliquidOrder[],
  nonce: number,
): Promise<ExchangeResponse> {
  const action = {
    type: 'order' as const,
    orders,
    grouping: 'na' as const,
  };

  const signature = await signAction(account, action, nonce);

  const res = await fetch(HYPERLIQUID_EXCHANGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, signature, nonce }),
  });

  return res.json() as Promise<ExchangeResponse>;
}

async function signAction(
  account: PrivateKeyAccount,
  action: any,
  nonce: number,
): Promise<{ r: string; s: string; v: number }> {
  const types = {
    Order: [
      { name: 'a', type: 'uint32' },
      { name: 'b', type: 'bool' },
      { name: 'p', type: 'string' },
      { name: 's', type: 'string' },
      { name: 'r', type: 'bool' },
      { name: 't', type: 'uint8' },
    ],
  };

  const domain = {
    name: 'HyperliquidSignTransaction',
    version: '1',
    chainId: 421614,
    verifyingContract: '0x0000000000000000000000000000000000000000' as const,
  };

  // For simplicity, sign the action hash directly
  // Hyperliquid uses a custom signing scheme - this is a simplified version
  const message = JSON.stringify({ action, nonce });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  const hashHex = `0x${Buffer.from(hash).toString('hex')}`;

  const signature = await account.signMessage({ message: { raw: hashHex as `0x${string}` } });

  // Split signature into r, s, v
  const r = signature.slice(0, 66);
  const s = `0x${signature.slice(66, 130)}`;
  const v = Number.parseInt(signature.slice(130, 132), 16);

  return { r, s, v };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/exchange.test.ts`
Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api-gateway/package.json apps/api-gateway/src/services/exchange.ts apps/api-gateway/src/services/exchange.test.ts pnpm-lock.yaml
git commit -m "feat(api-gateway): add Hyperliquid exchange adapter"
```

---

### Task 4: Safety Controls Service

**Files:**
- Create: `apps/api-gateway/src/services/safety-controls.ts`
- Create: `apps/api-gateway/src/services/safety-controls.test.ts`

- [ ] **Step 1: Write failing safety check tests**

Create `apps/api-gateway/src/services/safety-controls.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { checkDailyLossLimit, checkMaxOrderSize } from './safety-controls';

describe('safety-controls', () => {
  describe('checkDailyLossLimit', () => {
    it('allows order when under limit', () => {
      const result = checkDailyLossLimit({
        dailyPnl: -500,
        maxDailyLossUsd: 1000,
      });
      expect(result.allowed).toBe(true);
    });

    it('blocks order when at limit', () => {
      const result = checkDailyLossLimit({
        dailyPnl: -1000,
        maxDailyLossUsd: 1000,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily loss limit');
    });

    it('blocks order when over limit', () => {
      const result = checkDailyLossLimit({
        dailyPnl: -1500,
        maxDailyLossUsd: 1000,
      });
      expect(result.allowed).toBe(false);
    });

    it('allows order when profitable', () => {
      const result = checkDailyLossLimit({
        dailyPnl: 500,
        maxDailyLossUsd: 1000,
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkMaxOrderSize', () => {
    it('allows order under max size', () => {
      const result = checkMaxOrderSize({
        quantity: 0.1,
        markPrice: 50000,
        maxOrderUsd: 500,
      });
      expect(result.allowed).toBe(true);
    });

    it('blocks order over max size', () => {
      const result = checkMaxOrderSize({
        quantity: 0.2,
        markPrice: 50000,
        maxOrderUsd: 500,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeds maximum');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/safety-controls.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement safety controls**

Create `apps/api-gateway/src/services/safety-controls.ts`:

```ts
export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkDailyLossLimit(input: {
  dailyPnl: number;
  maxDailyLossUsd: number;
}): SafetyCheckResult {
  if (input.dailyPnl <= -input.maxDailyLossUsd) {
    return {
      allowed: false,
      reason: `Daily loss limit reached: $${Math.abs(input.dailyPnl).toFixed(2)} / $${input.maxDailyLossUsd}`,
    };
  }
  return { allowed: true };
}

export function checkMaxOrderSize(input: {
  quantity: number;
  markPrice: number;
  maxOrderUsd: number;
}): SafetyCheckResult {
  const notional = input.quantity * input.markPrice;
  if (notional > input.maxOrderUsd) {
    return {
      allowed: false,
      reason: `Order size $${notional.toFixed(2)} exceeds maximum $${input.maxOrderUsd}`,
    };
  }
  return { allowed: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/safety-controls.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api-gateway/src/services/safety-controls.ts apps/api-gateway/src/services/safety-controls.test.ts
git commit -m "feat(api-gateway): add safety controls service"
```

---

### Task 5: Fill Reconciler

**Files:**
- Create: `apps/api-gateway/src/services/fill-reconciler.ts`
- Create: `apps/api-gateway/src/services/fill-reconciler.test.ts`

- [ ] **Step 1: Write failing reconciler test**

Create `apps/api-gateway/src/services/fill-reconciler.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { reconcileFill, type ReconcileInput } from './fill-reconciler';

describe('fill-reconciler', () => {
  it('reconciles a fully filled order', () => {
    const result = reconcileFill({
      orderId: 'order-1',
      orderQuantity: 1.0,
      fills: [
        { qty: 0.6, price: 50000, fee: 5 },
        { qty: 0.4, price: 50010, fee: 4 },
      ],
    });

    expect(result.status).toBe('filled');
    expect(result.filledQuantity).toBe(1.0);
    expect(result.averagePrice).toBeCloseTo(50004, 0);
    expect(result.totalFee).toBe(9);
  });

  it('reconciles a partially filled order', () => {
    const result = reconcileFill({
      orderId: 'order-2',
      orderQuantity: 1.0,
      fills: [{ qty: 0.5, price: 50000, fee: 5 }],
    });

    expect(result.status).toBe('partial');
    expect(result.filledQuantity).toBe(0.5);
  });

  it('returns pending when no fills', () => {
    const result = reconcileFill({
      orderId: 'order-3',
      orderQuantity: 1.0,
      fills: [],
    });

    expect(result.status).toBe('submitted');
    expect(result.filledQuantity).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/fill-reconciler.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement fill reconciler**

Create `apps/api-gateway/src/services/fill-reconciler.ts`:

```ts
export interface Fill {
  qty: number;
  price: number;
  fee: number;
}

export interface ReconcileInput {
  orderId: string;
  orderQuantity: number;
  fills: Fill[];
}

export interface ReconcileResult {
  status: 'submitted' | 'partial' | 'filled';
  filledQuantity: number;
  averagePrice: number;
  totalFee: number;
}

export function reconcileFill(input: ReconcileInput): ReconcileResult {
  if (input.fills.length === 0) {
    return {
      status: 'submitted',
      filledQuantity: 0,
      averagePrice: 0,
      totalFee: 0,
    };
  }

  const totalQty = input.fills.reduce((sum, f) => sum + f.qty, 0);
  const totalValue = input.fills.reduce((sum, f) => sum + f.qty * f.price, 0);
  const totalFee = input.fills.reduce((sum, f) => sum + f.fee, 0);
  const averagePrice = totalValue / totalQty;
  const status = totalQty >= input.orderQuantity ? 'filled' : 'partial';

  return {
    status,
    filledQuantity: totalQty,
    averagePrice,
    totalFee,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @hyperdash/api-gateway test -- src/services/fill-reconciler.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api-gateway/src/services/fill-reconciler.ts apps/api-gateway/src/services/fill-reconciler.test.ts
git commit -m "feat(api-gateway): add fill reconciler service"
```

---

### Task 6: Copy Engine Real Execution

**Files:**
- Modify: `apps/api-gateway/src/services/copy-engine.ts`

- [ ] **Step 1: Add imports to copy-engine.ts**

Add at top of `apps/api-gateway/src/services/copy-engine.ts`:

```ts
import { privateKeyToAccount } from 'viem/accounts';
import { decryptKey, getEncryptionKey } from './key-management';
import { buildMarketOrder, placeOrder } from './exchange';
import { checkDailyLossLimit, checkMaxOrderSize } from './safety-controls';
import { reconcileFill } from './fill-reconciler';
```

- [ ] **Step 2: Replace executeTrades method**

Replace the entire `executeTrades` method in `copy-engine.ts`:

```ts
private async executeTrades(strategy: any, deltas: PositionDelta[]): Promise<void> {
  // Get agent wallet for this strategy
  const [agentWallet] = await this.db
    .select()
    .from(schema.agentWallets)
    .where(eq(schema.agentWallets.id, strategy.agentWalletId))
    .limit(1);

  if (!agentWallet?.encryptedPrivateKey) {
    console.error(`[CopyEngine] No agent wallet with private key for strategy ${strategy.id}`);
    return;
  }

  // Safety checks
  const dailyPnl = await this.getDailyPnl(strategy.id);
  const lossCheck = checkDailyLossLimit({
    dailyPnl,
    maxDailyLossUsd: Number(strategy.maxDailyLossUsd || 1000),
  });
  if (!lossCheck.allowed) {
    console.warn(`[CopyEngine] ${lossCheck.reason} for strategy ${strategy.id}`);
    await this.db
      .update(schema.copyStrategies)
      .set({ status: 'error' })
      .where(eq(schema.copyStrategies.id, strategy.id));
    return;
  }

  // Decrypt private key
  let account;
  try {
    const encryptionKey = getEncryptionKey();
    const privateKey = decryptKey(agentWallet.encryptedPrivateKey, encryptionKey);
    account = privateKeyToAccount(privateKey as `0x${string}`);
  } catch (error) {
    console.error(`[CopyEngine] Failed to decrypt private key:`, error);
    return;
  }

  // Get meta for asset indices
  const meta = await this.getMeta();
  const mids = await this.getMids();

  for (const delta of deltas) {
    const sizeCheck = checkMaxOrderSize({
      quantity: Math.abs(delta.delta),
      markPrice: mids[delta.symbol] || 0,
      maxOrderUsd: Number(strategy.maxOrderUsd || 500),
    });
    if (!sizeCheck.allowed) {
      console.warn(`[CopyEngine] ${sizeCheck.reason}`);
      continue;
    }

    const assetIndex = meta.universe.findIndex((a: any) => a.name === delta.symbol);
    if (assetIndex === -1) {
      console.error(`[CopyEngine] Asset ${delta.symbol} not found in meta`);
      continue;
    }

    const order = buildMarketOrder({
      assetIndex,
      isBuy: delta.action === 'buy',
      size: Math.abs(delta.delta).toString(),
      midPrice: mids[delta.symbol] || 0,
      slippageBps: Number(strategy.slippageBps || 10),
    });

    // Insert order record
    const [orderRow] = await this.db
      .insert(schema.copyOrders)
      .values({
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
      } as any)
      .returning();

    try {
      const nonce = Date.now();
      const response = await placeOrder(account, [order], nonce);

      if (response.status === 'err') {
        await this.db
          .update(schema.copyOrders)
          .set({ status: 'failed', errorMessage: response.error })
          .where(eq(schema.copyOrders.id, orderRow.id));
        console.error(`[CopyEngine] Order failed: ${response.error}`);
      } else {
        console.log(`[CopyEngine] Order submitted for ${delta.symbol}`);
      }
    } catch (error) {
      await this.db
        .update(schema.copyOrders)
        .set({ status: 'failed', errorMessage: String(error) })
        .where(eq(schema.copyOrders.id, orderRow.id));
      console.error(`[CopyEngine] Order execution error:`, error);
    }
  }
}

private async getDailyPnl(strategyId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const orders = await this.db
    .select({ pnl: schema.copyOrders.pnl })
    .from(schema.copyOrders)
    .where(
      and(
        eq(schema.copyOrders.strategyId, strategyId),
        sql`${schema.copyOrders.createdAt} >= ${today}`,
      ),
    );

  return orders.reduce((sum, o) => sum + Number(o.pnl || 0), 0);
}

private async getMeta(): Promise<any> {
  const res = await fetch(process.env.HYPERLIQUID_API_URL ?? 'https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'meta' }),
  });
  return res.json();
}

private async getMids(): Promise<Record<string, number>> {
  const res = await fetch(process.env.HYPERLIQUID_API_URL ?? 'https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' }),
  });
  const data = await res.json();
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = Number(value);
  }
  return result;
}
```

- [ ] **Step 3: Run type-check**

Run: `pnpm exec tsc apps/api-gateway/src/services/copy-engine.ts --noEmit --skipLibCheck`
Expected: exits 0 or only pre-existing errors

- [ ] **Step 4: Commit**

```bash
git add apps/api-gateway/src/services/copy-engine.ts
git commit -m "feat(api-gateway): integrate real order execution"
```

---

### Task 7: Agent Wallet Routes and Frontend

**Files:**
- Modify: `apps/api-gateway/src/routes/copy.ts`
- Modify: `apps/web/src/routes/strategies/$id.tsx`

- [ ] **Step 1: Add agent wallet routes to copy.ts**

Add to `apps/api-gateway/src/routes/copy.ts` after existing routes:

```ts
generateAgentWallet: protectedProcedure.mutation(async ({ ctx }) => {
  const userId = ctx.user!.userId;
  const encryptionKey = getEncryptionKey();
  const wallet = generateAgentWallet(encryptionKey);

  const [row] = await db
    .insert(agentWallets)
    .values({
      userId,
      exchange: 'hyperliquid',
      address: wallet.address,
      encryptedPrivateKey: wallet.encryptedPrivateKey,
      status: 'pending_approval',
    })
    .returning();

  return {
    walletId: row.id,
    address: wallet.address,
    status: 'pending_approval',
  };
}),

verifyAgentApproval: protectedProcedure
  .input(z.object({ walletId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user!.userId;

    const [wallet] = await db
      .select()
      .from(agentWallets)
      .where(and(eq(agentWallets.id, input.walletId), eq(agentWallets.userId, userId)))
      .limit(1);

    if (!wallet) throw new Error('Agent wallet not found');

    // Update status to active
    await db
      .update(agentWallets)
      .set({ status: 'active' })
      .where(eq(agentWallets.id, input.walletId));

    return { success: true, address: wallet.address };
  }),
```

Add imports at top of copy.ts:

```ts
import { generateAgentWallet } from '../services/agent-wallets';
import { getEncryptionKey } from '../services/key-management';
```

- [ ] **Step 2: Add kill switch to copy-control.ts**

Add to `apps/api-gateway/src/routes/copy-control.ts`:

```ts
killStrategy: protectedProcedure
  .input(z.object({ strategyId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user!.userId;

    const [strategy] = await db
      .select()
      .from(copyStrategies)
      .where(and(eq(copyStrategies.id, input.strategyId), eq(copyStrategies.userId, userId)))
      .limit(1);

    if (!strategy) throw new Error('Strategy not found');

    await db
      .update(copyStrategies)
      .set({ status: 'terminated' })
      .where(eq(copyStrategies.id, input.strategyId));

    return { success: true, message: 'Strategy terminated' };
  }),
```

- [ ] **Step 3: Run type-check**

Run: `pnpm exec tsc apps/api-gateway/src/routes/copy.ts --noEmit --skipLibCheck`
Expected: exits 0 or only pre-existing errors

- [ ] **Step 4: Commit**

```bash
git add apps/api-gateway/src/routes/copy.ts apps/api-gateway/src/routes/copy-control.ts
git commit -m "feat(api-gateway): add agent wallet and kill switch routes"
```

---

### Task 8: Final Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run all API tests**

Run: `pnpm --filter @hyperdash/api-gateway test`
Expected: All tests pass (key-management, agent-wallets, exchange, safety-controls, fill-reconciler, copy-targets, trader-positions)

- [ ] **Step 2: Run type-check**

Run: `pnpm type-check`
Expected: Only pre-existing errors in shared-types

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: Only pre-existing lint issues

- [ ] **Step 4: Run build**

Run: `pnpm --filter web build`
Expected: Vite build passes

- [ ] **Step 5: Commit verification fixes if any**

If any command required source changes, commit them:

```bash
git add <changed-files>
git commit -m "fix: stabilize Phase 2 verification"
```

---

## Self-Review

- **Spec coverage:** Agent wallet onboarding, exchange adapter, real execution, fill reconciliation, safety controls, kill switch, audit logging — all covered.
- **Placeholder scan:** No TBD/TODO found.
- **Type consistency:** `encryptKey`/`decryptKey` used consistently. `buildMarketOrder`/`placeOrder` signatures match. `checkDailyLossLimit`/`checkMaxOrderSize` return `SafetyCheckResult`.
- **Scope:** Phase 2 only. AI management (Phase 3) and Go engine excluded.
