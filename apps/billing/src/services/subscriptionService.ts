import stripe from 'stripe';
import { config } from '../config';
import { logger } from '../utils/logger';
import { PostgreSQLService } from './postgreService';
import { RedisService } from './redisService';

export class SubscriptionService {
  private postgresService: PostgreSQLService;
  private redisService: RedisService;
  private stripe: stripe.Stripe;

  constructor() {
    this.postgresService = new PostgreSQLService();
    this.redisService = new RedisService();
    this.stripe = new stripe(config.stripe.secretKey);
  }

  async getCurrentSubscription(userId: string) {
    const cacheKey = `subscription:${userId}`;

    // Try to get from cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from database
    const subscription = await this.postgresService.getCurrentSubscription(userId);

    // Cache for 5 minutes
    if (subscription) {
      await this.redisService.setex(cacheKey, 300, JSON.stringify(subscription));
    }

    return subscription;
  }

  async createSubscription(userId: string, planId: string, paymentMethodId: string) {
    // Get user and plan information
    const [user, plan] = await Promise.all([
      this.postgresService.getUser(userId),
      this.postgresService.getSubscriptionPlan(planId),
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    if (!plan) {
      throw new Error('Subscription plan not found');
    }

    // Create Stripe subscription
    const stripeSubscription = await this.stripe.subscriptions.create({
      customer: user.stripe_customer_id,
      items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: plan.features.join(', '),
            },
            unit_amount: Math.round(plan.price * 100),
            recurring: {
              interval: plan.interval as stripe.Price.Recurring.Interval,
            },
          },
        },
      ],
      default_payment_method: paymentMethodId,
      expand: ['latest_invoice.payment_intent'],
    });

    // Store subscription in database
    const subscription = await this.postgresService.createSubscription({
      userId,
      planId,
      stripeSubscriptionId: stripeSubscription.id,
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    });

    // Clear cache
    await this.redisService.del(`subscription:${userId}`);

    return subscription;
  }

  async updateSubscription(userId: string, subscriptionId: string, newPlanId: string) {
    const subscription = await this.postgresService.getSubscription(subscriptionId);

    if (!subscription || subscription.user_id !== userId) {
      throw new Error('Subscription not found or unauthorized');
    }

    const newPlan = await this.postgresService.getSubscriptionPlan(newPlanId);
    if (!newPlan) {
      throw new Error('New subscription plan not found');
    }

    // Update Stripe subscription
    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id,
    );

    // Find the subscription item
    const subscriptionItem = stripeSubscription.items.data[0];

    // Create new price for the plan
    const newPrice = await this.stripe.prices.create({
      currency: 'usd',
      unit_amount: Math.round(newPlan.price * 100),
      recurring: {
        interval: newPlan.interval as stripe.Price.Recurring.Interval,
      },
      product_data: {
        name: newPlan.name,
      },
    });

    // Update the subscription
    const updatedStripeSubscription = await this.stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        items: [
          {
            id: subscriptionItem.id,
            price: newPrice.id,
          },
        ],
        proration_behavior: 'create_prorations',
      },
    );

    // Update database
    const updatedSubscription = await this.postgresService.updateSubscription(subscriptionId, {
      planId: newPlanId,
      status: updatedStripeSubscription.status,
      currentPeriodStart: new Date(updatedStripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(updatedStripeSubscription.current_period_end * 1000),
    });

    // Clear cache
    await this.redisService.del(`subscription:${userId}`);

    return updatedSubscription;
  }

  async cancelSubscription(
    userId: string,
    subscriptionId: string,
    immediate: boolean = false,
    reason?: string,
  ) {
    const subscription = await this.postgresService.getSubscription(subscriptionId);

    if (!subscription || subscription.user_id !== userId) {
      throw new Error('Subscription not found or unauthorized');
    }

    let updatedStripeSubscription;

    if (immediate) {
      // Cancel immediately
      updatedStripeSubscription = await this.stripe.subscriptions.cancel(
        subscription.stripe_subscription_id,
      );
    } else {
      // Cancel at period end
      updatedStripeSubscription = await this.stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        {
          cancel_at_period_end: true,
        },
      );
    }

    // Update database
    const updatedSubscription = await this.postgresService.updateSubscription(subscriptionId, {
      status: updatedStripeSubscription.status,
      cancelledAt: immediate ? new Date() : null,
      cancellationReason: reason,
    });

    // Clear cache
    await this.redisService.del(`subscription:${userId}`);

    return updatedSubscription;
  }

  async reactivateSubscription(userId: string, subscriptionId: string) {
    const subscription = await this.postgresService.getSubscription(subscriptionId);

    if (!subscription || subscription.user_id !== userId) {
      throw new Error('Subscription not found or unauthorized');
    }

    if (!subscription.cancelled_at) {
      throw new Error('Subscription is not cancelled');
    }

    // Reactivate in Stripe
    const updatedStripeSubscription = await this.stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: false,
        trial_end: 'now',
      },
    );

    // Update database
    const updatedSubscription = await this.postgresService.updateSubscription(subscriptionId, {
      status: updatedStripeSubscription.status,
      cancelledAt: null,
      cancellationReason: null,
    });

    // Clear cache
    await this.redisService.del(`subscription:${userId}`);

    return updatedSubscription;
  }

  async getAvailablePlans() {
    const cacheKey = 'subscription_plans';

    // Try to get from cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from database
    const plans = await this.postgresService.getActiveSubscriptionPlans();

    // Cache for 1 hour
    await this.redisService.setex(cacheKey, 3600, JSON.stringify(plans));

    return plans;
  }

  async handleSubscriptionPaymentSucceeded(invoice: stripe.Invoice) {
    if (!invoice.subscription) return;

    const subscription = await this.postgresService.getSubscriptionByStripeId(
      invoice.subscription as string,
    );
    if (!subscription) return;

    // Update subscription status
    await this.postgresService.updateSubscription(subscription.id, {
      status: 'active',
    });

    // Clear cache
    await this.redisService.del(`subscription:${subscription.user_id}`);

    // Send confirmation email (placeholder)
    logger.info(`Payment succeeded for subscription ${subscription.id}`);
  }

  async handleSubscriptionPaymentFailed(invoice: stripe.Invoice) {
    if (!invoice.subscription) return;

    const subscription = await this.postgresService.getSubscriptionByStripeId(
      invoice.subscription as string,
    );
    if (!subscription) return;

    // Update subscription status
    await this.postgresService.updateSubscription(subscription.id, {
      status: 'past_due',
    });

    // Clear cache
    await this.redisService.del(`subscription:${subscription.user_id}`);

    // Send payment failure email (placeholder)
    logger.warn(`Payment failed for subscription ${subscription.id}`);
  }

  async handleSubscriptionCreated(stripeSubscription: stripe.Subscription) {
    const subscription = await this.postgresService.getSubscriptionByStripeId(
      stripeSubscription.id,
    );
    if (!subscription) return;

    // Update status
    await this.postgresService.updateSubscription(subscription.id, {
      status: stripeSubscription.status,
    });

    // Clear cache
    await this.redisService.del(`subscription:${subscription.user_id}`);

    logger.info(`Subscription created: ${subscription.id}`);
  }

  async handleSubscriptionUpdated(stripeSubscription: stripe.Subscription) {
    const subscription = await this.postgresService.getSubscriptionByStripeId(
      stripeSubscription.id,
    );
    if (!subscription) return;

    // Update subscription
    await this.postgresService.updateSubscription(subscription.id, {
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    });

    // Clear cache
    await this.redisService.del(`subscription:${subscription.user_id}`);

    logger.info(`Subscription updated: ${subscription.id}`);
  }

  async handleSubscriptionDeleted(stripeSubscription: stripe.Subscription) {
    const subscription = await this.postgresService.getSubscriptionByStripeId(
      stripeSubscription.id,
    );
    if (!subscription) return;

    // Update subscription
    await this.postgresService.updateSubscription(subscription.id, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    // Clear cache
    await this.redisService.del(`subscription:${subscription.user_id}`);

    logger.info(`Subscription deleted: ${subscription.id}`);
  }

  // Utility methods
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.getCurrentSubscription(userId);
    return subscription && subscription.status === 'active';
  }

  async canAccessFeature(userId: string, feature: string): Promise<boolean> {
    const subscription = await this.getCurrentSubscription(userId);

    if (!subscription) {
      // Check if feature is available in freemium plan
      const freemiumPlan = config.plans.freemium;
      return freemiumPlan.features.includes(feature);
    }

    // Check if feature is available in user's plan
    return subscription.plan.features.includes(feature);
  }

  async getRemainingQuota(userId: string, quotaType: 'api_calls' | 'copy_trades'): Promise<number> {
    const subscription = await this.getCurrentSubscription(userId);

    if (!subscription) {
      return config.plans.freemium[quotaType];
    }

    const used = await this.postgresService.getUsageCount(userId, quotaType, 'current_month');
    const limit = subscription.plan[quotaType];

    return Math.max(0, limit - used);
  }
}
