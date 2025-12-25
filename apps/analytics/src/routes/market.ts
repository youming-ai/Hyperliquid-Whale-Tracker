import { Router } from 'express';
import {
  getHeatmapData,
  getMarketOverview,
  getOHLCVData,
  getPriceHistory,
} from '../controllers/marketController';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// OHLCV data endpoints
router.get('/ohlcv/:symbol', asyncHandler(getOHLCVData));
router.get('/candles/:symbol', asyncHandler(getOHLCVData)); // Alias

// Heatmap data endpoints
router.get('/heatmap/:symbol', asyncHandler(getHeatmapData));
router.get('/liquidity/:symbol', asyncHandler(getHeatmapData)); // Alias

// Market overview endpoints
router.get('/overview/:symbol', asyncHandler(getMarketOverview));
router.get('/summary/:symbol', asyncHandler(getMarketOverview)); // Alias

// Price history endpoints
router.get('/price/:symbol', asyncHandler(getPriceHistory));
router.get('/history/:symbol', asyncHandler(getPriceHistory)); // Alias

export { router as marketRoutes };
