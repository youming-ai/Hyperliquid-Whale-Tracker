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
