import { Router } from 'express';
import {
  createPaymentMethod,
  deletePaymentMethod,
  getInvoices,
  getPaymentMethods,
  getUsageMetrics,
} from '../controllers/billingController';
import { asyncHandler } from '../middleware/errorHandler';

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
