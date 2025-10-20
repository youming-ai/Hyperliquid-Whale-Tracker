import { Request, Response } from 'express';
import { SubscriptionService } from '../services/subscriptionService';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';

const subscriptionService = new SubscriptionService();

export const getSubscription = async (req: Request, res: Response) => {
  try {
    const { userId } = req.user; // Assuming userId is extracted from auth middleware

    if (!userId) {
      throw createError('User ID is required', 401);
    }

    const subscription = await subscriptionService.getCurrentSubscription(userId);

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    logger.error('Error fetching subscription:', error);
    throw createError('Failed to fetch subscription', 500);
  }
};

export const createSubscription = async (req: Request, res: Response) => {
  try {
    const { userId } = req.user;
    const { planId, paymentMethodId } = req.body;

    if (!userId) {
      throw createError('User ID is required', 401);
    }

    if (!planId) {
      throw createError('Plan ID is required', 400);
    }

    if (!paymentMethodId) {
      throw createError('Payment method ID is required', 400);
    }

    const subscription = await subscriptionService.createSubscription(userId, planId, paymentMethodId);

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription created successfully',
    });
  } catch (error) {
    logger.error('Error creating subscription:', error);
    throw createError('Failed to create subscription', 500);
  }
};

export const updateSubscription = async (req: Request, res: Response) => {
  try {
    const { userId } = req.user;
    const { subscriptionId } = req.params;
    const { planId } = req.body;

    if (!userId) {
      throw createError('User ID is required', 401);
    }

    if (!planId) {
      throw createError('Plan ID is required', 400);
    }

    const subscription = await subscriptionService.updateSubscription(userId, subscriptionId, planId);

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription updated successfully',
    });
  } catch (error) {
    logger.error('Error updating subscription:', error);
    throw createError('Failed to update subscription', 500);
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const { userId } = req.user;
    const { subscriptionId } = req.params;
    const { immediate = false, reason } = req.body;

    if (!userId) {
      throw createError('User ID is required', 401);
    }

    const subscription = await subscriptionService.cancelSubscription(userId, subscriptionId, immediate, reason);

    res.json({
      success: true,
      data: subscription,
      message: immediate ? 'Subscription cancelled immediately' : 'Subscription will be cancelled at period end',
    });
  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    throw createError('Failed to cancel subscription', 500);
  }
};

export const reactivateSubscription = async (req: Request, res: Response) => {
  try {
    const { userId } = req.user;
    const { subscriptionId } = req.params;

    if (!userId) {
      throw createError('User ID is required', 401);
    }

    const subscription = await subscriptionService.reactivateSubscription(userId, subscriptionId);

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription reactivated successfully',
    });
  } catch (error) {
    logger.error('Error reactivating subscription:', error);
    throw createError('Failed to reactivate subscription', 500);
  }
};

export const getSubscriptionPlans = async (req: Request, res: Response) => {
  try {
    const plans = await subscriptionService.getAvailablePlans();

    res.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    logger.error('Error fetching subscription plans:', error);
    throw createError('Failed to fetch subscription plans', 500);
  }
};
