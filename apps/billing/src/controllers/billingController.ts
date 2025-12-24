import type { Request, Response } from 'express';
import { createError } from '../middleware/errorHandler';
import { BillingService } from '../services/billingService';
import { logger } from '../utils/logger';

const billingService = new BillingService();

export const getUsageMetrics = async (req: Request, res: Response) => {
  try {
    const { userId } = req.user; // Assuming userId is extracted from auth middleware
    const { timeframe = 'current' } = req.query;

    if (!userId) {
      throw createError('User ID is required', 401);
    }

    const usage = await billingService.getUsageMetrics(userId, timeframe as string);

    res.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    logger.error('Error fetching usage metrics:', error);
    throw createError('Failed to fetch usage metrics', 500);
  }
};

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const { userId } = req.user;
    const { limit = 10, offset = 0, status } = req.query;

    if (!userId) {
      throw createError('User ID is required', 401);
    }

    const invoices = await billingService.getInvoices(userId, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      status: status as string,
    });

    res.json({
      success: true,
      data: invoices,
      meta: {
        count: invoices.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    throw createError('Failed to fetch invoices', 500);
  }
};

export const getPaymentMethods = async (req: Request, res: Response) => {
  try {
    const { userId } = req.user;

    if (!userId) {
      throw createError('User ID is required', 401);
    }

    const paymentMethods = await billingService.getPaymentMethods(userId);

    res.json({
      success: true,
      data: paymentMethods,
    });
  } catch (error) {
    logger.error('Error fetching payment methods:', error);
    throw createError('Failed to fetch payment methods', 500);
  }
};

export const createPaymentMethod = async (req: Request, res: Response) => {
  try {
    const { userId } = req.user;
    const { paymentMethodId } = req.body;

    if (!userId) {
      throw createError('User ID is required', 401);
    }

    if (!paymentMethodId) {
      throw createError('Payment method ID is required', 400);
    }

    const paymentMethod = await billingService.createPaymentMethod(userId, paymentMethodId);

    res.json({
      success: true,
      data: paymentMethod,
      message: 'Payment method added successfully',
    });
  } catch (error) {
    logger.error('Error creating payment method:', error);
    throw createError('Failed to create payment method', 500);
  }
};

export const deletePaymentMethod = async (req: Request, res: Response) => {
  try {
    const { userId } = req.user;
    const { paymentMethodId } = req.params;

    if (!userId) {
      throw createError('User ID is required', 401);
    }

    await billingService.deletePaymentMethod(userId, paymentMethodId);

    res.json({
      success: true,
      message: 'Payment method removed successfully',
    });
  } catch (error) {
    logger.error('Error deleting payment method:', error);
    throw createError('Failed to delete payment method', 500);
  }
};
