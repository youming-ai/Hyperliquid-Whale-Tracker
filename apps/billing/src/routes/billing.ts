import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { getUsageMetrics } from '../controllers/billingController';
import { getInvoices } from '../controllers/billingController';
import { getPaymentMethods } from '../controllers/billingController';
import { createPaymentMethod } from '../controllers/billingController';
import { deletePaymentMethod } from '../controllers/billingController';

const router = Router();

// Usage metrics endpoints
router.get('/usage', asyncHandler(getUsageMetrics));

// Invoice endpoints
router.get('/invoices', asyncHandler(getInvoices));

// Payment method endpoints
router.get('/payment-methods', asyncHandler(getPaymentMethods));
router.post('/payment-methods', asyncHandler(createPaymentMethod));
router.delete('/payment-methods/:paymentMethodId', asyncHandler(deletePaymentMethod));

export { router as billingRoutes };
