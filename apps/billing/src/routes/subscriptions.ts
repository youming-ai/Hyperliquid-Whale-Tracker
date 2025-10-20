import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { getSubscription } from '../controllers/subscriptionController';
import { createSubscription } from '../controllers/subscriptionController';
import { updateSubscription } from '../controllers/subscriptionController';
import { cancelSubscription } from '../controllers/subscriptionController';
import { getSubscriptionPlans } from '../controllers/subscriptionController';
import { reactivateSubscription } from '../controllers/subscriptionController';

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
