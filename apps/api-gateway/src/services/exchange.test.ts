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
    expect(price).toBe('50050');
  });

  it('calculates order price with slippage for sell', () => {
    const price = getOrderPrice(3000, false, 10);
    expect(price).toBe('2997');
  });
});
