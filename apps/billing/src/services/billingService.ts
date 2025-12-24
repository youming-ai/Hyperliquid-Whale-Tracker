import { config } from '../config';
import { logger } from '../utils/logger';
import { PostgreSQLService } from './postgreService';
import { RedisService } from './redisService';

interface UsageMetrics {
  apiCalls: {
    current: number;
    limit: number;
    resetDate: Date;
  };
  copyTrades: {
    current: number;
    limit: number;
    resetDate: Date;
  };
  storage: {
    current: number;
    limit: number;
  };
}

interface InvoiceFilters {
  limit: number;
  offset: number;
  status?: string;
}

interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  brand: string;
  expiresMonth: number;
  expiresYear: number;
  isDefault: boolean;
}

export class BillingService {
  private postgresService: PostgreSQLService;
  private redisService: RedisService;

  constructor() {
    this.postgresService = new PostgreSQLService();
    this.redisService = new RedisService();
  }

  async getUsageMetrics(userId: string, timeframe: string): Promise<UsageMetrics> {
    const cacheKey = `usage_metrics:${userId}:${timeframe}`;

    // Try to get from cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get user's subscription
    const subscription = await this.postgresService.getUserSubscription(userId);

    // Get current usage
    const [apiUsage, copyUsage] = await Promise.all([
      this.postgresService.getAPIUsage(userId, timeframe),
      this.postgresService.getCopyTradingUsage(userId, timeframe),
    ]);

    const metrics: UsageMetrics = {
      apiCalls: {
        current: apiUsage.calls,
        limit: subscription.plan.apiCallsPerMonth,
        resetDate: this.getResetDate(),
      },
      copyTrades: {
        current: copyUsage.trades,
        limit: subscription.plan.maxCopies > 0 ? copyUsage.allowedTrades : 0,
        resetDate: this.getResetDate(),
      },
      storage: {
        current: 0, // TODO: Implement storage usage tracking
        limit: subscription.plan.storageGB || 10,
      },
    };

    // Cache for 5 minutes
    await this.redisService.setex(cacheKey, 300, JSON.stringify(metrics));

    return metrics;
  }

  async getInvoices(userId: string, filters: InvoiceFilters) {
    const invoices = await this.postgresService.getInvoices(userId, filters);
    return invoices;
  }

  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    const paymentMethods = await this.postgresService.getPaymentMethods(userId);
    return paymentMethods;
  }

  async createPaymentMethod(userId: string, paymentMethodId: string): Promise<PaymentMethod> {
    const paymentMethod = await this.postgresService.createPaymentMethod(userId, paymentMethodId);

    // Clear cache
    await this.redisService.del(`payment_methods:${userId}`);

    return paymentMethod;
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    await this.postgresService.deletePaymentMethod(userId, paymentMethodId);

    // Clear cache
    await this.redisService.del(`payment_methods:${userId}`);
  }

  // Billing operations
  async createInvoice(userId: string, amount: number, description: string): Promise<any> {
    const invoice = await this.postgresService.createInvoice(userId, amount, description);
    return invoice;
  }

  async processPayment(invoiceId: string, paymentMethodId: string): Promise<any> {
    const payment = await this.postgresService.processPayment(invoiceId, paymentMethodId);
    return payment;
  }

  async refundPayment(paymentId: string, amount?: number): Promise<any> {
    const refund = await this.postgresService.refundPayment(paymentId, amount);
    return refund;
  }

  // Usage tracking
  async trackAPIUsage(userId: string, endpoint: string): Promise<void> {
    await this.postgresService.incrementAPIUsage(userId, endpoint);

    // Update cache
    const cacheKey = `usage_metrics:${userId}:current`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      const metrics = JSON.parse(cached);
      metrics.apiCalls.current += 1;
      await this.redisService.setex(cacheKey, 300, JSON.stringify(metrics));
    }
  }

  async trackCopyTradingUsage(userId: string, traderId: string): Promise<void> {
    await this.postgresService.incrementCopyTradingUsage(userId, traderId);

    // Update cache
    const cacheKey = `usage_metrics:${userId}:current`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      const metrics = JSON.parse(cached);
      metrics.copyTrades.current += 1;
      await this.redisService.setex(cacheKey, 300, JSON.stringify(metrics));
    }
  }

  // Billing analytics
  async getBillingAnalytics(timeframe: string): Promise<any> {
    const analytics = await this.postgresService.getBillingAnalytics(timeframe);
    return analytics;
  }

  async getRevenueMetrics(timeframe: string): Promise<any> {
    const metrics = await this.postgresService.getRevenueMetrics(timeframe);
    return metrics;
  }

  async getChurnMetrics(timeframe: string): Promise<any> {
    const metrics = await this.postgresService.getChurnMetrics(timeframe);
    return metrics;
  }

  // Dunning and collections
  async processOverdueInvoices(): Promise<any> {
    const overdueInvoices = await this.postgresService.getOverdueInvoices();

    for (const invoice of overdueInvoices) {
      // Send reminder emails
      await this.sendPaymentReminder(invoice);

      // Update invoice status
      await this.postgresService.updateInvoiceStatus(invoice.id, 'reminder_sent');
    }

    return { processed: overdueInvoices.length };
  }

  async cancelOverdueSubscriptions(): Promise<any> {
    const overdueSubscriptions = await this.postgresService.getOverdueSubscriptions();

    for (const subscription of overdueSubscriptions) {
      await this.postgresService.cancelSubscription(subscription.id, 'payment_overdue');

      // Send cancellation email
      await this.sendSubscriptionCancellationEmail(subscription);
    }

    return { cancelled: overdueSubscriptions.length };
  }

  // Helper methods
  private getResetDate(): Date {
    const now = new Date();
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return resetDate;
  }

  // Email notifications (placeholders)
  private async sendPaymentReminder(invoice: any): Promise<void> {
    // TODO: Implement email sending
    logger.info(`Sending payment reminder for invoice ${invoice.id}`);
  }

  private async sendSubscriptionCancellationEmail(subscription: any): Promise<void> {
    // TODO: Implement email sending
    logger.info(`Sending cancellation email for subscription ${subscription.id}`);
  }
}
