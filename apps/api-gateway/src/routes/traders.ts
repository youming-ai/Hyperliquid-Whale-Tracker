import { publicProcedure, t } from '@hyperdash/contracts';
import { getDatabaseConnection } from '@hyperdash/database';
import { z } from 'zod';
import * as traderService from '../services/traders';

/**
 * Trader Router
 * Handles trader discovery, rankings, profiles, and performance analytics
 */
export const tradersRouter = t.router({
  // Get traders list with filtering and sorting
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        sortBy: z.enum(['pnl', 'winrate', 'winRate', 'trades', 'sharpe', 'equity']).default('pnl'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
        timeframe: z.enum(['7d', '30d', '90d', 'all']).default('7d'),
        minPnl: z.number().optional(),
        minWinrate: z.number().optional(),
        minTrades: z.number().optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .query(async ({ input }) => {
      const traders = await traderService.getTraders(input);

      return traders.map((t) => ({
        traderId: t.traderId,
        rank: t.rank,
        address: t.address,
        pnl7d: Number(t.pnl7d),
        pnl30d: Number(t.pnl30d),
        pnlAll: Number(t.pnlAll),
        winRate: Number(t.winrate),
        totalTrades: t.totalTrades,
        equity: Number(t.equityUsd),
        sharpe: t.sharpeRatio ? Number(t.sharpeRatio) : 0,
        maxDrawdown: Number(t.maxDrawdown),
        isActive: t.lastTradeAt
          ? new Date(t.lastTradeAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          : false,
        lastTradeAt: t.lastTradeAt?.toISOString() ?? null,
      }));
    }),

  // Get trader profile by address
  byAddress: publicProcedure
    .input(
      z.object({
        address: z.string().length(42),
      }),
    )
    .query(async ({ input }) => {
      const trader = await traderService.getTraderByAddress(input.address);

      if (!trader) {
        throw new Error('Trader not found');
      }

      return {
        address: trader.address,
        equity: Number(trader.equityUsd),
        pnl7d: Number(trader.pnl7d),
        pnl30d: Number(trader.pnl30d),
        pnlAll: Number(trader.pnlAll),
        winRate: Number(trader.winrate),
        totalTrades: trader.totalTrades,
        winningTrades: trader.winningTrades,
        losingTrades: trader.losingTrades,
        maxDrawdown: Number(trader.maxDrawdown),
        sharpeRatio: trader.sharpeRatio ? Number(trader.sharpeRatio) : 0,
        avgHoldTimeSeconds: trader.avgHoldTimeSeconds,
        lastTradeAt: trader.lastTradeAt?.toISOString() ?? null,
        firstTradeAt: trader.firstTradeAt?.toISOString() ?? null,
        longTrades: trader.longTrades,
        shortTrades: trader.shortTrades,
        avgPositionSizeUsd: Number(trader.avgPositionSizeUsd),
        rank7d: trader.rank7d,
        rank30d: trader.rank30d,
      };
    }),

  // Get trader trades history
  trades: publicProcedure
    .input(
      z.object({
        address: z.string().length(42),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        symbol: z.string().optional(),
        side: z.enum(['long', 'short']).optional(),
        closedOnly: z.boolean().default(true),
      }),
    )
    .query(async ({ input }) => {
      const { trades, total } = await traderService.getTraderTrades({
        traderAddress: input.address,
        limit: input.limit,
        offset: input.offset,
        symbol: input.symbol,
        side: input.side,
        closedOnly: input.closedOnly,
      });

      return {
        trades: trades.map((t) => ({
          id: t.id,
          symbol: t.symbol,
          side: t.side,
          action: t.action,
          size: Number(t.size),
          entryPrice: t.entryPrice ? Number(t.entryPrice) : null,
          exitPrice: t.exitPrice ? Number(t.exitPrice) : null,
          pnl: Number(t.pnl),
          pnlBps: t.pnlBps,
          feeUsd: Number(t.feeUsd),
          openedAt: t.openedAt.toISOString(),
          closedAt: t.closedAt?.toISOString() ?? null,
          holdDurationSeconds: t.holdDurationSeconds,
        })),
        total,
        hasMore: input.offset + trades.length < total,
      };
    }),

  // Get trader performance analytics
  performance: publicProcedure
    .input(
      z.object({
        address: z.string().length(42),
        timeframe: z.enum(['7d', '30d', 'all']).default('30d'),
      }),
    )
    .query(async ({ input }) => {
      const performance = await traderService.getTraderPerformance(input.address, input.timeframe);

      if (!performance) {
        throw new Error('Trader not found');
      }

      return {
        traderId: performance.traderId,
        address: performance.address,
        timeframe: performance.timeframe,
        periodStart: performance.periodStart.toISOString(),
        periodEnd: performance.periodEnd.toISOString(),
        summary: {
          totalReturn: performance.summary.totalReturn,
          totalPnl: performance.summary.totalPnl,
          totalVolume: performance.summary.totalVolume,
          winRate: performance.summary.winRate,
          sharpeRatio: performance.summary.sharpeRatio,
          maxDrawdown: performance.summary.maxDrawdown,
          totalTrades: performance.summary.totalTrades,
          winningTrades: performance.summary.winningTrades,
          losingTrades: performance.summary.losingTrades,
        },
      };
    }),

  // Search traders
  search: publicProcedure
    .input(
      z.object({
        query: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const traders = await traderService.searchTraders(input);

      return traders.map((t) => ({
        address: t.address,
        equity: Number(t.equityUsd),
        pnl7d: Number(t.pnl7d),
        pnl30d: Number(t.pnl30d),
        winRate: Number(t.winrate),
        totalTrades: t.totalTrades,
        sharpeRatio: t.sharpeRatio ? Number(t.sharpeRatio) : 0,
        isActive: t.lastTradeAt
          ? new Date(t.lastTradeAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          : false,
      }));
    }),

  positions: publicProcedure
    .input(
      z.object({
        address: z.string().length(42),
      }),
    )
    .query(async ({ input }) => {
      const positions = await traderService.getTraderPositions(input.address);

      return positions.map((position) => ({
        id: position.id,
        traderId: position.traderId,
        symbol: position.symbol,
        side: position.side,
        quantity: Number(position.quantity),
        entryPrice: Number(position.entryPrice),
        markPrice: Number(position.markPrice),
        positionValueUsd: Number(position.positionValueUsd),
        unrealizedPnl: Number(position.unrealizedPnl || 0),
        marginUsed: Number(position.marginUsed || 0),
        leverage: Number(position.leverage || 1),
        liquidationPrice: position.liquidationPrice ? Number(position.liquidationPrice) : null,
        lastUpdatedAt: position.lastUpdatedAt?.toISOString() ?? null,
      }));
    }),

  // Health check for traders service
  health: publicProcedure.query(async () => {
    const db = getDatabaseConnection();
    const health = await db.healthCheck();

    return {
      status: health.status,
      database: health,
      timestamp: new Date().toISOString(),
    };
  }),
});
