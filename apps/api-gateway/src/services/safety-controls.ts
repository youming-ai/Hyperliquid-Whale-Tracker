export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkDailyLossLimit(input: {
  dailyPnl: number;
  maxDailyLossUsd: number;
}): SafetyCheckResult {
  if (input.dailyPnl < -input.maxDailyLossUsd) {
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
