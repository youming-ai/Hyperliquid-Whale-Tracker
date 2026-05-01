import { type PrivateKeyAccount } from 'viem/accounts';

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
  const body = JSON.stringify({ action, signature, nonce });

  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      const res = await fetch(HYPERLIQUID_EXCHANGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (res.status === 429 || res.status >= 500) {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
          continue;
        }
      }

      return res.json() as Promise<ExchangeResponse>;
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }

  throw new Error('Failed to place order after retries');
}

async function signAction(
  account: PrivateKeyAccount,
  action: any,
  nonce: number,
): Promise<{ r: string; s: string; v: number }> {
  const actionHash = await computeActionHash(action);

  const domain = {
    name: 'HyperliquidSignTransaction',
    version: '1',
    chainId: 421614,
    verifyingContract: '0x0000000000000000000000000000000000000000' as const,
  };

  const types = {
    HyperliquidTransaction: [
      { name: 'action', type: 'bytes32' },
      { name: 'nonce', type: 'uint64' },
    ],
  };

  const message = {
    action: actionHash,
    nonce: BigInt(nonce),
  };

  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: 'HyperliquidTransaction',
    message,
  });

  const r = signature.slice(0, 66);
  const s = `0x${signature.slice(66, 130)}`;
  const v = Number.parseInt(signature.slice(130, 132), 16);

  return { r, s, v };
}

async function computeActionHash(action: any): Promise<`0x${string}`> {
  const encoded = new TextEncoder().encode(JSON.stringify(action));
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return `0x${Buffer.from(hash).toString('hex')}`;
}
