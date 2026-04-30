/**
 * Copy Trading Execution Engine
 *
 * This module handles the core copy trading execution logic:
 * - Monitors active strategies
 * - Fetches source trader positions/trades
 * - Calculates target positions
 * - Executes copy trades on behalf of users
 * - Manages position synchronization
 */

import * as schema from '@hyperdash/database';
import { and, desc, eq, sql } from 'drizzle-orm';
import { calculateCopyTargets } from './copy-targets';
import { getDatabaseConnection } from '../services/connection';

export interface ExecutionConfig {
  executionInterval: number; // seconds between execution cycles
  maxConcurrentStrategies: number;
  maxRetries: number;
  retryDelayMs: number;
}

export interface StrategyExecutionState {
  strategyId: string;
  userId: string;
  status: 'active' | 'paused' | 'error' | 'terminated';
  lastExecutionAt?: Date;
  lastError?: string;
  alignmentRate: number;
}

export interface PositionDelta {
  symbol: string;
  side: 'long' | 'short';
  currentQuantity: number;
  targetQuantity: number;
  delta: number;
  action: 'buy' | 'sell' | 'hold';
}

export class CopyTradingEngine {
  private config: ExecutionConfig;
  private executionStates: Map<string, StrategyExecutionState> = new Map();
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private db = getDatabaseConnection().getDatabase();

  constructor(config: ExecutionConfig = {}) {
    this.config = {
      executionInterval: 5, // 5 seconds
      maxConcurrentStrategies: 10,
      maxRetries: 3,
      retryDelayMs: 1000,
      ...config,
    };
  }

  /**
   * Start the execution engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[CopyEngine] Already running');
      return;
    }

    console.log('[CopyEngine] Starting execution engine...');
    this.isRunning = true;

    // Load active strategies into execution states
    await this.loadActiveStrategies();

    // Start periodic execution
    this.intervalId = setInterval(() => {
      this.executeCycle().catch((error) => {
        console.error('[CopyEngine] Execution cycle error:', error);
      });
    }, this.config.executionInterval * 1000);

    console.log('[CopyEngine] Execution engine started');
  }

  /**
   * Stop the execution engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[CopyEngine] Stopping execution engine...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    console.log('[CopyEngine] Execution engine stopped');
  }

  /**
   * Load active strategies from database
   */
  private async loadActiveStrategies(): Promise<void> {
    const strategies = await this.db
      .select({
        id: schema.copyStrategies.id,
        userId: schema.copyStrategies.userId,
        status: schema.copyStrategies.status,
      })
      .from(schema.copyStrategies)
      .where(eq(schema.copyStrategies.status, 'active'));

    for (const strategy of strategies) {
      this.executionStates.set(strategy.id, {
        strategyId: strategy.id,
        userId: strategy.userId,
        status: strategy.status as any,
        alignmentRate: 100,
      });
    }

    console.log(`[CopyEngine] Loaded ${strategies.length} active strategies`);
  }

  /**
   * Execute a single cycle of copy trading logic
   */
  private async executeCycle(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const startTime = Date.now();
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    // Process each active strategy
    for (const [strategyId, state] of this.executionStates.entries()) {
      if (state.status !== 'active') {
        continue;
      }

      if (processedCount >= this.config.maxConcurrentStrategies) {
        break;
      }

      processedCount++;

      try {
        await this.processStrategy(strategyId);
        successCount++;
      } catch (error) {
        errorCount++;
        state.lastError = error instanceof Error ? error.message : String(error);
        console.error(`[CopyEngine] Error processing strategy ${strategyId}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    if (processedCount > 0) {
      console.log(
        `[CopyEngine] Cycle completed: ${processedCount} processed, ${successCount} success, ${errorCount} errors, ${duration}ms`,
      );
    }
  }

  /**
   * Process a single strategy
   */
  private async processStrategy(strategyId: string): Promise<void> {
    const state = this.executionStates.get(strategyId);
    if (!state) {
      return;
    }

    // Get strategy details with allocations
    const strategies = await this.db
      .select()
      .from(schema.copyStrategies)
      .where(eq(schema.copyStrategies.id, strategyId))
      .limit(1);

    if (!strategies[0]) {
      this.executionStates.delete(strategyId);
      return;
    }

    const strategy = strategies[0];

    // Get allocations
    const allocations = await this.db
      .select()
      .from(schema.copyAllocations)
      .where(
        and(
          eq(schema.copyAllocations.strategyId, strategyId),
          eq(schema.copyAllocations.status, 'active'),
        ),
      );

    if (allocations.length === 0) {
      return; // No active allocations
    }

    // Get current positions
    const currentPositions = await this.getCurrentPositions(strategyId);

    // Get target positions based on trader allocations
    const targetPositions = await this.calculateTargetPositions(strategy, allocations);

    // Calculate position deltas
    const deltas = this.calculatePositionDeltas(
      currentPositions,
      targetPositions,
      Number(strategy.minOrderUsd || 5),
    );

    // Execute trades if needed
    if (deltas.length > 0) {
      await this.executeTrades(strategy, deltas);
    }

    // Calculate and update alignment rate
    const alignmentRate = this.calculateAlignmentRate(currentPositions, targetPositions);

    // Update state
    state.lastExecutionAt = new Date();
    state.alignmentRate = alignmentRate;

    // Update strategy performance in database
    await this.db
      .update(schema.copyStrategies)
      .set({
        alignmentRate: alignmentRate.toString(),
        updatedAt: new Date(),
      })
      .where(eq(schema.copyStrategies.id, strategyId));
  }

  /**
   * Get current positions for a strategy
   */
  private async getCurrentPositions(
    strategyId: string,
  ): Promise<Map<string, { quantity: number; side: string; entryPrice: number }>> {
    const positions = await this.db
      .select()
      .from(schema.copyPositions)
      .where(
        and(
          eq(schema.copyPositions.strategyId, strategyId),
          sql`${schema.copyPositions.closedAt} IS NULL`,
        ),
      );

    const result = new Map();
    for (const pos of positions) {
      result.set(`${pos.symbol}:${pos.side}`, {
        quantity: Number(pos.quantity),
        side: pos.side as 'long' | 'short',
        entryPrice: Number(pos.entryPrice),
      });
    }

    return result;
  }

  /**
   * Calculate target positions based on trader allocations
   */
  private async calculateTargetPositions(
    strategy: any,
    allocations: any[],
  ): Promise<Map<string, { quantity: number; side: string }>> {
    const traderIds = allocations.map((allocation) => allocation.traderId);

    if (traderIds.length === 0) return new Map();

    const traders = await this.db
      .select({
        traderId: schema.traderStats.traderId,
        equityUsd: schema.traderStats.equityUsd,
      })
      .from(schema.traderStats)
      .where(sql`${schema.traderStats.traderId} = ANY(${traderIds})`);

    const sourcePositions = await this.db
      .select()
      .from(schema.traderPositions)
      .where(sql`${schema.traderPositions.traderId} = ANY(${traderIds})`);

    const targets = calculateCopyTargets({
      strategy: {
        maxPositionUsd: Number(strategy.maxPositionUsd || 10_000),
        maxLeverage: Number(strategy.maxLeverage || 3),
        minOrderUsd: Number(strategy.minOrderUsd || 5),
      },
      allocations: allocations.map((allocation) => ({
        traderId: allocation.traderId,
        weight: Number(allocation.weight),
      })),
      traders: traders.map((trader) => ({
        traderId: trader.traderId,
        equityUsd: Number(trader.equityUsd || 0),
      })),
      sourcePositions: sourcePositions.map((position) => ({
        traderId: position.traderId,
        symbol: position.symbol,
        side: position.side,
        quantity: Number(position.quantity),
        markPrice: Number(position.markPrice),
        positionValueUsd: Number(position.positionValueUsd),
      })),
    });

    const targetPositions = new Map<string, { quantity: number; side: string }>();
    for (const target of targets) {
      targetPositions.set(`${target.symbol}:${target.side}`, {
        quantity: target.targetQuantity,
        side: target.side,
      });
    }

    return targetPositions;
  }

  /**
   * Calculate position deltas (changes needed)
   */
  private calculatePositionDeltas(
    current: Map<string, { quantity: number; side: string }>,
    target: Map<string, { quantity: number; side: string }>,
    minOrderSize: number,
  ): PositionDelta[] {
    const deltas: PositionDelta[] = [];

    // All symbols involved
    const allSymbols = new Set([...current.keys(), ...target.keys()]);

    for (const symbol of allSymbols) {
      const curr = current.get(symbol);
      const targ = target.get(symbol);

      const currentQty = curr?.quantity || 0;
      const targetQty = targ?.quantity || 0;
      const side = (targ?.side || curr?.side || 'long') as 'long' | 'short';

      const delta = targetQty - currentQty;

      // Only create delta if change is significant
      if (Math.abs(delta) >= minOrderSize) {
        deltas.push({
          symbol,
          side,
          currentQuantity: currentQty,
          targetQuantity: targetQty,
          delta,
          action: delta > 0 ? 'buy' : 'sell',
        });
      }
    }

    return deltas;
  }

  /**
   * Execute trades to achieve target positions
   */
  private async executeTrades(strategy: any, deltas: PositionDelta[]): Promise<void> {
    for (const delta of deltas) {
      // Create copy order record
      await this.db.insert(schema.copyOrders).values({
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
        errorMessage: null,
      } as any);

      // TODO: Integrate with Hyperliquid API to execute actual trades
      console.log(
        `[CopyEngine] Would execute ${delta.action} ${Math.abs(delta.delta)} ${delta.symbol} for strategy ${strategy.id}`,
      );
    }
  }

  /**
   * Calculate alignment rate between current and target positions
   */
  private calculateAlignmentRate(
    current: Map<string, { quantity: number; side: string }>,
    target: Map<string, { quantity: number; side: string }>,
  ): number {
    if (target.size === 0) {
      return 100;
    }

    let totalDeviation = 0;
    let count = 0;

    for (const [symbol, targ] of target) {
      const curr = current.get(symbol);
      const currentQty = curr?.quantity || 0;
      const targetQty = targ.quantity;

      if (targetQty !== 0) {
        const deviation = Math.abs(targetQty - currentQty) / targetQty;
        totalDeviation += deviation;
        count++;
      }
    }

    if (count === 0) {
      return 100;
    }

    const alignment = (1 - totalDeviation / count) * 100;
    return Math.max(0, Math.min(100, alignment));
  }

  /**
   * Get engine status
   */
  getStatus(): {
    isRunning: boolean;
    activeStrategies: number;
    executionStates: Map<string, StrategyExecutionState>;
  } {
    const activeCount = Array.from(this.executionStates.values()).filter(
      (s) => s.status === 'active',
    ).length;

    return {
      isRunning: this.isRunning,
      activeStrategies: activeCount,
      executionStates: this.executionStates,
    };
  }

  /**
   * Reload strategies from database
   */
  async reloadStrategies(): Promise<void> {
    await this.loadActiveStrategies();
    console.log('[CopyEngine] Strategies reloaded');
  }
}

// Singleton instance
let engineInstance: CopyTradingEngine | null = null;

export function getCopyTradingEngine(config?: ExecutionConfig): CopyTradingEngine {
  if (!engineInstance) {
    engineInstance = new CopyTradingEngine(config);
  }
  return engineInstance;
}
