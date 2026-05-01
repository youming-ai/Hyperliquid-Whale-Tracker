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

    it('allows order when at limit', () => {
      const result = checkDailyLossLimit({
        dailyPnl: -1000,
        maxDailyLossUsd: 1000,
      });
      expect(result.allowed).toBe(true);
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
        quantity: 0.001,
        markPrice: 50000,
        maxOrderUsd: 500,
      });
      expect(result.allowed).toBe(true);
    });

    it('allows order at exact max size', () => {
      const result = checkMaxOrderSize({
        quantity: 0.01,
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
