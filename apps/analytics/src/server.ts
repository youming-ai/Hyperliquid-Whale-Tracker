import cors from 'cors';
import express from 'express';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { analyticsRoutes } from './routes/analytics';
import { marketRoutes } from './routes/market';
import { logger } from './utils/logger';

export class AnalyticsServer {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(
      cors({
        origin: config.corsOrigins,
        credentials: true,
      }),
    );

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use(requestLogger);

    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: 'analytics',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use(config.apiPrefix, analyticsRoutes);
    this.app.use(`${config.apiPrefix}/market`, marketRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Hyperliquid Analytics Service',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          analytics: `${config.apiPrefix}`,
          market: `${config.apiPrefix}/market`,
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
          logger.info(`Analytics server started on port ${config.port}`);
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
          logger.info('Analytics server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
