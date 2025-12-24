import { Router } from 'express';
import { handleStripeWebhook } from '../controllers/webhookController';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Stripe webhook endpoint
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  asyncHandler(handleStripeWebhook),
);

export { router as webhookRoutes };
