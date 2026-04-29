export interface CopyTargetStrategyInput {
  maxPositionUsd: number;
  maxLeverage: number;
  minOrderUsd: number;
}

export interface CopyTargetAllocationInput {
  traderId: string;
  weight: number;
}

export interface CopyTargetTraderInput {
  traderId: string;
  equityUsd: number;
}

export interface CopyTargetSourcePositionInput {
  traderId: string;
  symbol: string;
  side: string;
  quantity: number;
  markPrice: number;
  positionValueUsd: number;
}

export interface CopyTargetPosition {
  symbol: string;
  side: 'long' | 'short';
  targetQuantity: number;
  targetNotionalUsd: number;
}

export function calculateCopyTargets(input: {
  strategy: CopyTargetStrategyInput;
  allocations: CopyTargetAllocationInput[];
  traders: CopyTargetTraderInput[];
  sourcePositions: CopyTargetSourcePositionInput[];
}): CopyTargetPosition[] {
  const tradersById = new Map(input.traders.map((trader) => [trader.traderId, trader]));
  const aggregate = new Map<string, CopyTargetPosition>();

  for (const allocation of input.allocations) {
    const trader = tradersById.get(allocation.traderId);
    if (!trader || trader.equityUsd <= 0) continue;

    const allocationCapital = input.strategy.maxPositionUsd * allocation.weight;
    const positions = input.sourcePositions.filter(
      (position) => position.traderId === allocation.traderId && position.markPrice > 0,
    );

    for (const position of positions) {
      const exposureRatio = position.positionValueUsd / trader.equityUsd;
      const rawNotional = allocationCapital * exposureRatio;
      const maxLeveredNotional = allocationCapital * input.strategy.maxLeverage;
      const targetNotionalUsd = Math.min(rawNotional, maxLeveredNotional);
      if (targetNotionalUsd < input.strategy.minOrderUsd) continue;

      const side = position.side === 'short' ? 'short' : 'long';
      const key = `${position.symbol}:${side}`;
      const existing = aggregate.get(key);
      const targetQuantity = targetNotionalUsd / position.markPrice;

      if (existing) {
        existing.targetQuantity += targetQuantity;
        existing.targetNotionalUsd += targetNotionalUsd;
      } else {
        aggregate.set(key, {
          symbol: position.symbol,
          side,
          targetQuantity,
          targetNotionalUsd,
        });
      }
    }
  }

  return Array.from(aggregate.values());
}
