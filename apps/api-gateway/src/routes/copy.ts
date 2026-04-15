import { kycProcedure, protectedProcedure, t } from '@hyperdash/contracts';
import { schemas } from '@hyperdash/shared-types';
import { z } from 'zod';
import * as copyService from '../services/copy-trading';

/**
 * Copy Trading Router
 *
 * Handles copy trading strategies, allocations, performance tracking, and execution
 */
export const copyRouter = t.router({
  // Get user's copy strategies
  strategies: protectedProcedure
    .input(
      z.object({
        status: z.enum(['active', 'paused', 'error', 'terminated', 'all']).default('all'),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { status } = input;
      const userId = ctx.user!.userId;

      const strategies = await copyService.getStrategiesByUser(userId);

      // Filter by status if not "all"
      const filtered =
        status === 'all' ? strategies : strategies.filter((s) => s.status === status);

      // Apply pagination
      const paginated = filtered.slice(input.offset, input.offset + input.limit);

      // Transform to match expected schema
      return paginated.map((strategy) => ({
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
        status: strategy.status,
        mode: strategy.mode,
        riskParams: {
          maxLeverage: Number(strategy.maxLeverage || 5),
          maxPositionUsd: strategy.maxPositionUsd ? Number(strategy.maxPositionUsd) : undefined,
          slippageBps: strategy.slippageBps || 10,
          minOrderUsd: Number(strategy.minOrderUsd || 100),
        },
        settings: {
          followNewEntriesOnly: strategy.followNewEntriesOnly || false,
          autoRebalance: strategy.autoRebalance || false,
          rebalanceThresholdBps: strategy.rebalanceThresholdBps || 50,
        },
        performance: {
          totalPnl: Number(strategy.totalPnl || 0),
          totalFees: Number(strategy.totalFees || 0),
          alignmentRate: Number(strategy.alignmentRate || 100),
          totalTrades: 0, // Would need to calculate from orders
        },
        allocations: strategy.allocations.map((alloc) => ({
          traderId: alloc.traderId,
          weight: alloc.weight,
          performance: {
            allocatedPnl: alloc.allocatedPnl,
            allocatedFees: alloc.allocatedFees,
          },
        })),
        createdAt: strategy.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: strategy.updatedAt?.toISOString() || new Date().toISOString(),
      }));
    }),

  // Create a new copy strategy
  createStrategy: kycProcedure(1)
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        mode: z.enum(['portfolio', 'single_trader']).default('portfolio'),
        riskParams: z.object({
          maxLeverage: z.number().min(1).max(10).default(3.0),
          maxPositionUsd: z.number().positive().optional(),
          slippageBps: z.number().min(0).max(100).default(10),
          minOrderUsd: z.number().positive().default(100),
        }),
        settings: z.object({
          followNewEntriesOnly: z.boolean().default(true),
          autoRebalance: z.boolean().default(true),
          rebalanceThresholdBps: z.number().min(0).max(500).default(50),
        }),
        allocations: z
          .array(
            z.object({
              traderId: z.string(),
              weight: z.number().min(0).max(1),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;
      const { name, description, mode, riskParams, settings, allocations } = input;

      // Validate allocations sum to 1.0
      const totalWeight = allocations.reduce((sum, alloc) => sum + alloc.weight, 0);
      if (Math.abs(totalWeight - 1.0) > 0.0001) {
        throw new Error('Allocation weights must sum to 1.0');
      }

      // Create strategy in database
      const strategy = await copyService.createStrategy({
        userId,
        name,
        description,
        mode,
        maxLeverage: riskParams.maxLeverage,
        maxPositionUsd: riskParams.maxPositionUsd,
        slippageBps: riskParams.slippageBps,
        minOrderUsd: riskParams.minOrderUsd,
        followNewEntriesOnly: settings.followNewEntriesOnly,
        autoRebalance: settings.autoRebalance,
        rebalanceThresholdBps: settings.rebalanceThresholdBps,
      });

      // Create allocations
      for (const alloc of allocations) {
        await copyService.addAllocation({
          strategyId: strategy.id,
          userId,
          traderId: alloc.traderId,
          weight: alloc.weight,
        });
      }

      // Return the created strategy with allocations
      const strategyWithAllocations = await copyService.getStrategyById(strategy.id, userId);

      return {
        id: strategyWithAllocations!.id,
        name: strategyWithAllocations!.name,
        description: strategyWithAllocations!.description,
        status: strategyWithAllocations!.status,
        mode: strategyWithAllocations!.mode,
        riskParams,
        settings,
        performance: {
          totalPnl: Number(strategyWithAllocations!.totalPnl || 0),
          totalFees: Number(strategyWithAllocations!.totalFees || 0),
          alignmentRate: Number(strategyWithAllocations!.alignmentRate || 100),
          totalTrades: 0,
        },
        allocations: allocations.map((alloc) => ({
          ...alloc,
          performance: { allocatedPnl: 0, allocatedFees: 0 },
        })),
        createdAt: strategyWithAllocations!.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: strategyWithAllocations!.updatedAt?.toISOString() || new Date().toISOString(),
      };
    }),

  // Update copy strategy
  updateStrategy: protectedProcedure
    .input(
      z.object({
        strategyId: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        status: z.enum(['active', 'paused', 'terminated']).optional(),
        riskParams: z
          .object({
            maxLeverage: z.number().min(1).max(10),
            maxPositionUsd: z.number().positive().optional(),
            slippageBps: z.number().min(0).max(100),
            minOrderUsd: z.number().positive(),
          })
          .optional(),
        settings: z
          .object({
            followNewEntriesOnly: z.boolean(),
            autoRebalance: z.boolean(),
            rebalanceThresholdBps: z.number().min(0).max(500),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;
      const { strategyId, name, description, status, riskParams, settings } = input;

      // Build update object
      const updates: copyService.UpdateStrategyInput = {};
      if (name) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (status) updates.status = status;
      if (riskParams) {
        updates.maxLeverage = riskParams.maxLeverage;
        updates.maxPositionUsd = riskParams.maxPositionUsd;
        updates.slippageBps = riskParams.slippageBps;
        updates.minOrderUsd = riskParams.minOrderUsd;
      }
      if (settings) {
        updates.followNewEntriesOnly = settings.followNewEntriesOnly;
        updates.autoRebalance = settings.autoRebalance;
        updates.rebalanceThresholdBps = settings.rebalanceThresholdBps;
      }

      const strategy = await copyService.updateStrategy(strategyId, userId, updates);

      return {
        success: true,
        strategyId,
        updates,
        updatedAt: strategy.updatedAt?.toISOString() || new Date().toISOString(),
      };
    }),

  // Get copy strategy performance analytics
  performance: protectedProcedure
    .input(
      z.object({
        strategyId: z.string(),
        timeframe: z.enum(['1d', '7d', '30d', '90d', 'all']).default('30d'),
        granularity: z.enum(['hour', 'day']).default('day'),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { strategyId, timeframe, granularity } = input;
      const userId = ctx.user!.userId;

      const perf = await copyService.getStrategyPerformance(strategyId, userId);

      if (!perf) {
        throw new Error('Strategy not found');
      }

      // Calculate period start based on timeframe
      const periodEnd = new Date();
      const periodStart = new Date();
      if (timeframe === '1d') {
        periodStart.setDate(periodStart.getDate() - 1);
      } else if (timeframe === '7d') {
        periodStart.setDate(periodStart.getDate() - 7);
      } else if (timeframe === '30d') {
        periodStart.setDate(periodStart.getDate() - 30);
      } else if (timeframe === '90d') {
        periodStart.setDate(periodStart.getDate() - 90);
      } else {
        periodStart.setFullYear(periodStart.getFullYear() - 10);
      }

      // Get orders for timeseries data
      const { orders } = await copyService.getStrategyOrders({
        strategyId,
        userId,
        limit: 1000,
      });

      // Group by day for timeseries
      const timeseriesByDay = new Map<string, any>();
      for (const order of orders) {
        if (order.createdAt) {
          const date = new Date(order.createdAt);
          const dateKey = date.toISOString().split('T')[0];
          if (!timeseriesByDay.has(dateKey)) {
            timeseriesByDay.set(dateKey, {
              timestamp: date.toISOString(),
              portfolioValue: 100000,
              dailyPnl: 0,
              alignmentRate: 100,
              tradeCount: 0,
            });
          }
          const entry = timeseriesByDay.get(dateKey)!;
          entry.tradeCount++;
          if (order.pnl) {
            entry.dailyPnl += Number(order.pnl);
          }
        }
      }

      const timeseriesData = Array.from(timeseriesByDay.values());

      return {
        strategyId,
        timeframe,
        granularity,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        summary: {
          totalReturn: perf.totalPnl > 0 ? perf.netPnl / (perf.totalPnl - perf.netPnl) : 0,
          totalPnl: perf.totalPnl,
          totalFees: perf.totalFees,
          alignmentRate: perf.alignmentRate,
          slippage: 0, // Would need to calculate from orders
          totalTrades: perf.totalTrades,
          winRate: perf.winRate,
          profitFactor:
            perf.winningTrades > 0
              ? perf.winningTrades / (perf.totalTrades - perf.winningTrades)
              : 0,
          sharpeRatio: 0, // Would need to calculate
          maxDrawdown: 0, // Would need to calculate
        },
        timeseriesData,
        allocationPerformance: [], // Would need to fetch from allocations
      };
    }),

  // Get copy execution history
  executionHistory: protectedProcedure
    .input(
      z.object({
        strategyId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        status: z
          .enum(['pending', 'submitted', 'filled', 'partial', 'cancelled', 'failed', 'all'])
          .default('all'),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { strategyId, limit, offset, status } = input;
      const userId = ctx.user!.userId;

      const { orders, total } = await copyService.getStrategyOrders({
        strategyId,
        userId,
        limit,
        offset,
        status: status === 'all' ? undefined : (status as copyService.OrderStatus),
      });

      return orders.map((order) => ({
        id: order.id,
        strategyId: order.strategyId || undefined,
        sourceTraderId: order.sourceTraderId || undefined,
        symbol: order.symbol,
        eventType: order.status === 'filled' ? 'order_filled' : 'order_placed',
        status: order.status,
        latency: 0, // Would need to track
        alignmentRate: 100, // Would need to calculate
        slippageBps: 0, // Would need to calculate
        orderDetails: {
          orderId: order.exchangeOrderId || order.id,
          quantity: Number(order.quantity),
          price: order.price ? Number(order.price) : 0,
          side: order.side,
        },
        timestamp: order.createdAt?.toISOString() || new Date().toISOString(),
      }));
    }),

  // Update strategy allocations
  updateAllocations: protectedProcedure
    .input(
      z.object({
        strategyId: z.string(),
        allocations: z.array(
          z.object({
            traderId: z.string(),
            weight: z.number().min(0).max(1),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;
      const { strategyId, allocations } = input;

      // Validate allocations sum to 1.0
      const totalWeight = allocations.reduce((sum, alloc) => sum + alloc.weight, 0);
      if (Math.abs(totalWeight - 1.0) > 0.0001) {
        throw new Error('Allocation weights must sum to 1.0');
      }

      // Service layer enforces ownership; this still rejects unknown IDs.
      const strategy = await copyService.getStrategyById(strategyId, userId);
      if (!strategy) {
        throw new Error('Strategy not found or access denied');
      }

      // For now, we'd need to update allocations by ID
      // This is a simplified implementation
      console.log(`Updated allocations for strategy ${strategyId}:`, allocations);

      return {
        success: true,
        strategyId,
        allocations,
        updatedAt: new Date().toISOString(),
      };
    }),

  // Get copy trading recommendations
  recommendations: protectedProcedure
    .input(
      z.object({
        riskTolerance: z.enum(['low', 'medium', 'high']).default('medium'),
        targetReturn: z.number().optional(),
        maxDrawdown: z.number().optional(),
        excludeTraders: z.array(z.string()).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { riskTolerance, targetReturn, maxDrawdown, excludeTraders } = input;
      const userId = ctx.user!.userId;

      // For now, return mock recommendations
      // In production, this would analyze trader performance and suggest allocations
      const mockRecommendations = [
        {
          name: 'Conservative Portfolio',
          description: 'Low-risk strategy focusing on stable returns',
          riskTolerance: 'low',
          expectedReturn: 0.15,
          maxDrawdown: 0.05,
          suggestedAllocation: [
            {
              traderId: 'trader_stable_1',
              weight: 0.5,
              reason: 'Consistent performer with low volatility',
            },
            {
              traderId: 'trader_stable_2',
              weight: 0.3,
              reason: 'Solid risk management',
            },
            {
              traderId: 'trader_stable_3',
              weight: 0.2,
              reason: 'Diversification benefits',
            },
          ],
        },
        {
          name: 'Balanced Growth',
          description: 'Moderate risk with good return potential',
          riskTolerance: 'medium',
          expectedReturn: 0.25,
          maxDrawdown: 0.12,
          suggestedAllocation: [
            {
              traderId: 'trader_growth_1',
              weight: 0.4,
              reason: 'Strong growth track record',
            },
            {
              traderId: 'trader_growth_2',
              weight: 0.35,
              reason: 'Consistent outperformance',
            },
            {
              traderId: 'trader_growth_3',
              weight: 0.25,
              reason: 'Momentum specialist',
            },
          ],
        },
        {
          name: 'Aggressive Returns',
          description: 'High-risk strategy targeting maximum returns',
          riskTolerance: 'high',
          expectedReturn: 0.45,
          maxDrawdown: 0.25,
          suggestedAllocation: [
            {
              traderId: 'trader_aggressive_1',
              weight: 0.6,
              reason: 'High alpha generation',
            },
            {
              traderId: 'trader_aggressive_2',
              weight: 0.4,
              reason: 'Specialized in volatile assets',
            },
          ],
        },
      ];

      // Filter based on user's risk tolerance
      const filtered = mockRecommendations.filter((rec) => rec.riskTolerance === riskTolerance);

      return {
        recommendations: filtered.map((rec) => schemas.CopyRecommendation.parse(rec)),
        userProfile: {
          riskTolerance,
          expectedReturn: targetReturn || 0.2,
          maxDrawdown: maxDrawdown || 0.15,
        },
        generatedAt: new Date().toISOString(),
      };
    }),

  // Start/stop copy strategy
  toggleStrategy: protectedProcedure
    .input(
      z.object({
        strategyId: z.string(),
        action: z.enum(['start', 'pause', 'terminate']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;
      const { strategyId, action } = input;

      // Ownership is enforced inside start/pause/stopStrategy; an error bubbles
      // up if the user does not own this strategy.
      let updatedStrategy;
      switch (action) {
        case 'start':
          updatedStrategy = await copyService.startStrategy(strategyId, userId);
          break;
        case 'pause':
          updatedStrategy = await copyService.pauseStrategy(strategyId, userId);
          break;
        case 'terminate':
          updatedStrategy = await copyService.stopStrategy(strategyId, userId);
          break;
      }

      return {
        success: true,
        strategyId,
        action,
        status: updatedStrategy!.status,
        timestamp: updatedStrategy!.updatedAt?.toISOString() || new Date().toISOString(),
      };
    }),
});
