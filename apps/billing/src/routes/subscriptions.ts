import { Router } from 'express';
import {
  cancelSubscription,
  createSubscription,
  getSubscription,
  getSubscriptionPlans,
  reactivateSubscription,
  updateSubscription,
} from '../controllers/subscriptionController';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Subscription plans endpoints
router.get('/plans', asyncHandler(getSubscriptionPlans));

// User subscription endpoints
router.get('/current', asyncHandler(getSubscription));
router.post('/', asyncHandler(createSubscription));
router.put('/:subscriptionId', asyncHandler(updateSubscription));
router.post('/:subscriptionId/cancel', asyncHandler(cancelSubscription));
router.post('/:subscriptionId/reactivate', asyncHandler(reactivateSubscription));

export { router as subscriptionRoutes };
