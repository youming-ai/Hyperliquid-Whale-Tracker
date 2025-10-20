import { Request, Response } from 'express';
import { WebhookService } from '../services/webhookService';
import { logger } from '../utils/logger';
import { config } from '../config';
import { createError } from '../middleware/errorHandler';
import crypto from 'crypto';

const webhookService = new WebhookService();

export const handleStripeWebhook = async (req: Request, res: Response) => {
  try {
    const sig = req.headers['stripe-signature'] as string;

    if (!sig) {
      throw createError('No stripe signature', 400);
    }

    if (!config.stripe.webhookSecret) {
      throw createError('Webhook secret not configured', 500);
    }

    // Verify webhook signature
    let event;
    try {
      event = require('stripe')(config.stripe.secretKey).webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret
      );
    } catch (err) {
      logger.error('Webhook signature verification failed:', err);
      throw createError('Webhook signature verification failed', 400);
    }

    // Handle different event types
    await webhookService.handleStripeEvent(event);

    res.json({ received: true });
  } catch (error) {
    logger.error('Error handling Stripe webhook:', error);

    if (error.statusCode) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
