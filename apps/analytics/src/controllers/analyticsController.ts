import type { Request, Response } from 'express';
import { createError } from '../middleware/errorHandler';
import { AnalyticsService } from '../services/analyticsService';
import { logger } from '../utils/logger';

const analyticsService = new AnalyticsService();

export const getTopTraders = async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe = '7d', metric = 'pnl', limit = 100, offset = 0 } = req.query;

    const traders = await analyticsService.getTopTraders({
      symbol: symbol as string,
      timeframe: timeframe as string,
      metric: metric as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      data: traders,
      meta: {
        count: traders.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    logger.error('Error fetching top traders:', error);
    throw createError('Failed to fetch top traders', 500);
  }
};

export const getTraderProfile = async (req: Request, res: Response) => {
  try {
    const { traderId } = req.params;
    const { timeframe = '30d' } = req.query;

    if (!traderId) {
      throw createError('Trader ID is required', 400);
    }

    const profile = await analyticsService.getTraderProfile({
      traderId,
      timeframe: timeframe as string,
    });

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    logger.error('Error fetching trader profile:', error);
    throw createError('Failed to fetch trader profile', 500);
  }
};

export const getMarketStats = async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe = '24h' } = req.query;

    const stats = await analyticsService.getMarketStats({
      symbol: symbol as string,
      timeframe: timeframe as string,
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching market stats:', error);
    throw createError('Failed to fetch market stats', 500);
  }
};

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const { category = 'pnl', timeframe = '7d', limit = 50, symbol } = req.query;

    const leaderboard = await analyticsService.getLeaderboard({
      category: category as string,
      timeframe: timeframe as string,
      limit: parseInt(limit as string),
      symbol: symbol as string,
    });

    res.json({
      success: true,
      data: leaderboard,
      meta: {
        category,
        timeframe,
        count: leaderboard.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching leaderboard:', error);
    throw createError('Failed to fetch leaderboard', 500);
  }
};
