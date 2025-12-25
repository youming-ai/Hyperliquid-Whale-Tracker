import { Router } from 'express';
import {
  getLeaderboard,
  getMarketStats,
  getTopTraders,
  getTraderProfile,
} from '../controllers/analyticsController';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Top traders endpoints
router.get('/traders/top', asyncHandler(getTopTraders));
router.get('/traders/:traderId', asyncHandler(getTraderProfile));

// Market statistics endpoints
router.get('/market/stats', asyncHandler(getMarketStats));
router.get('/market/volume', asyncHandler(getMarketStats)); // Alias

// Leaderboard endpoints
router.get('/leaderboard', asyncHandler(getLeaderboard));
router.get('/leaderboard/traders', asyncHandler(getLeaderboard)); // Alias

export { router as analyticsRoutes };
