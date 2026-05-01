import { describe, expect, it } from 'vitest';
import { reconcileFill } from './fill-reconciler';

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
