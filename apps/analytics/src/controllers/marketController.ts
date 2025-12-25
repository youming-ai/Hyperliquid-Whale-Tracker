import type { Request, Response } from 'express';
import { createError } from '../middleware/errorHandler';
import { MarketAnalyticsService } from '../services/marketAnalyticsService';
import { logger } from '../utils/logger';

const marketAnalyticsService = new MarketAnalyticsService();

export const getOHLCVData = async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h', limit = 500, startTime, endTime } = req.query;

    if (!symbol) {
      throw createError('Symbol is required', 400);
    }

    const ohlcvData = await marketAnalyticsService.getOHLCVData({
      symbol,
      timeframe: timeframe as string,
      limit: parseInt(limit as string),
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
    });

    res.json({
      success: true,
      data: ohlcvData,
      meta: {
        symbol,
        timeframe,
        count: ohlcvData.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching OHLCV data:', error);
    throw createError('Failed to fetch OHLCV data', 500);
  }
};

export const getHeatmapData = async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { window = '1h', bins = 50, startTime, endTime } = req.query;

    if (!symbol) {
      throw createError('Symbol is required', 400);
    }

    const heatmapData = await marketAnalyticsService.getHeatmapData({
      symbol,
      window: window as string,
      bins: parseInt(bins as string),
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
    });

    res.json({
      success: true,
      data: heatmapData,
      meta: {
        symbol,
        window,
        bins,
        count: heatmapData.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching heatmap data:', error);
    throw createError('Failed to fetch heatmap data', 500);
  }
};

export const getMarketOverview = async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      throw createError('Symbol is required', 400);
    }

    const overview = await marketAnalyticsService.getMarketOverview(symbol);

    res.json({
      success: true,
      data: overview,
      meta: {
        symbol,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching market overview:', error);
    throw createError('Failed to fetch market overview', 500);
  }
};

export const getPriceHistory = async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h', limit = 1000, startTime, endTime } = req.query;

    if (!symbol) {
      throw createError('Symbol is required', 400);
    }

    const priceHistory = await marketAnalyticsService.getPriceHistory({
      symbol,
      timeframe: timeframe as string,
      limit: parseInt(limit as string),
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
    });

    res.json({
      success: true,
      data: priceHistory,
      meta: {
        symbol,
        timeframe,
        count: priceHistory.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching price history:', error);
    throw createError('Failed to fetch price history', 500);
  }
};
