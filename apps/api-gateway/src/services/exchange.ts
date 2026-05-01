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
  const message = JSON.stringify({ action, nonce });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  const hashHex = `0x${Buffer.from(hash).toString('hex')}`;

  const signature = await account.signMessage({ message: { raw: hashHex as `0x${string}` } });

  const r = signature.slice(0, 66);
  const s = `0x${signature.slice(66, 130)}`;
  const v = Number.parseInt(signature.slice(130, 132), 16);

  return { r, s, v };
}
