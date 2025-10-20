import express from 'express';
import cors from 'cors';
import stripe from 'stripe';
import { config } from './config';
import { logger } from './utils/logger';
import { billingRoutes } from './routes/billing';
import { subscriptionRoutes } from './routes/subscriptions';
import { webhookRoutes } from './routes/webhooks';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

export class BillingServer {
  private app: express.Application;
  private server: any;
  private stripe: stripe.Stripe;

  constructor() {
    this.app = express();
    this.stripe = new stripe(config.stripe.secretKey);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(cors({
      origin: config.corsOrigins,
      credentials: true,
    }));

    // Body parsing (important for Stripe webhooks)
    this.app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use(requestLogger);

    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: 'billing',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        stripe: this.stripe.apiVersion,
      });
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use(config.apiPrefix, billingRoutes);
    this.app.use(`${config.apiPrefix}/subscriptions`, subscriptionRoutes);
    this.app.use('/api/webhooks', webhookRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Hyperliquid Billing Service',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          billing: `${config.apiPrefix}`,
          subscriptions: `${config.apiPrefix}/subscriptions`,
          webhooks: '/api/webhooks',
        },
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(config.port, () => {
          logger.info(`Billing server started on port ${config.port}`);
          resolve();
        });

        this.server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`Port ${config.port} is already in use`);
          } else {
            logger.error('Server error:', error);
          }
          reject(error);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => this.stop());
        process.on('SIGINT', () => this.stop());

      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Billing server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getStripeInstance(): stripe.Stripe {
    return this.stripe;
  }
}
