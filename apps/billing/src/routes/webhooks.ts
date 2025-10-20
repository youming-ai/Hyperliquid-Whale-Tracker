import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { handleStripeWebhook } from '../controllers/webhookController';

const router = Router();

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), asyncHandler(handleStripeWebhook));

export { router as webhookRoutes };
