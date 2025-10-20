import winston from 'winston';
import 'winston-daily-rotate-file';
import { Request } from 'express';

export interface LogContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  error?: Error;
  [key: string]: any;
}

export interface LoggerConfig {
  level: string;
  silent: boolean;
  format: 'json' | 'pretty';
  enableFile: boolean;
  enableConsole: boolean;
  logDir?: string;
  maxFiles?: string;
  maxSize?: string;
  datePattern?: string;
}

class Logger {
  private winston: winston.Logger;
  private context: LogContext = {};

  constructor(config: LoggerConfig) {
    const transports: winston.transport[] = [];

    // Console transport
    if (config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          level: config.level,
          silent: config.silent,
          format: this.createConsoleFormat(config.format),
        })
      );
    }

    // File transports
    if (config.enableFile) {
      // Combined log file
      transports.push(
        new winston.transports.DailyRotateFile({
          level: config.level,
          silent: config.silent,
          filename: 'hyperdash-%DATE%.log',
          dirname: config.logDir || './logs',
          datePattern: config.datePattern || 'YYYY-MM-DD',
          maxSize: config.maxSize || '20m',
          maxFiles: config.maxFiles || '14d',
          format: this.createFileFormat('combined'),
        })
      );

      // Error-only log file
      transports.push(
        new winston.transports.DailyRotateFile({
          level: 'error',
          silent: config.silent,
          filename: 'hyperdash-error-%DATE%.log',
          dirname: config.logDir || './logs',
          datePattern: config.datePattern || 'YYYY-MM-DD',
          maxSize: config.maxSize || '20m',
          maxFiles: config.maxFiles || '30d',
          format: this.createFileFormat('error'),
        })
      );

      // Audit log file for security events
      transports.push(
        new winston.transports.DailyRotateFile({
          level: 'info',
          silent: config.silent,
          filename: 'hyperdash-audit-%DATE%.log',
          dirname: config.logDir || './logs',
          datePattern: config.datePattern || 'YYYY-MM-DD',
          maxSize: config.maxSize || '20m',
          maxFiles: config.maxFiles || '90d',
          format: this.createFileFormat('audit'),
        })
      );
    }

    this.winston = winston.createLogger({
      level: config.level,
      silent: config.silent,
      transports,
      exitOnError: false,
      handleExceptions: true,
      handleRejections: true,
    });

    // Add custom metadata
    this.winston.defaultMeta = {
      service: 'api-gateway',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      hostname: require('os').hostname(),
      pid: process.pid,
    };
  }

  private createConsoleFormat(format: 'json' | 'pretty'): winston.Logform.Format {
    if (format === 'json') {
      return winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.colorize({ all: true })
      );
    }

    return winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.colorize({ all: true }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    );
  }

  private createFileFormat(type: 'combined' | 'error' | 'audit'): winston.Logform.Format {
    const baseFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    if (type === 'audit') {
      return winston.format.combine(
        baseFormat,
        winston.format((info) => {
          info.logType = 'audit';
          return info;
        })()
      );
    }

    return baseFormat;
  }

  /**
   * Set context for subsequent log entries
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear current context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Get current context
   */
  getContext(): LogContext {
    return { ...this.context };
  }

  /**
   * Add context to a single log entry
   */
  withContext(context: LogContext): Logger {
    const logger = new Logger(this.createConfigFromCurrent());
    logger.setContext({ ...this.context, ...context });
    return logger;
  }

  /**
   * Create config from current logger state
   */
  private createConfigFromCurrent(): LoggerConfig {
    // This would extract config from current logger state
    // For simplicity, return default config
    return {
      level: 'info',
      silent: false,
      format: 'json',
      enableFile: true,
      enableConsole: true,
    };
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.winston.debug(message, { ...this.context, ...context });
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.winston.info(message, { ...this.context, ...context });
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.winston.warn(message, { ...this.context, ...context });
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.winston.error(message, {
      ...this.context,
      ...context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      })
    });
  }

  /**
   * Log audit event
   */
  audit(message: string, context: LogContext & {
    actorId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    oldValues?: any;
    newValues?: any;
    result?: 'success' | 'failure';
  }): void {
    this.winston.info(message, {
      logType: 'audit',
      timestamp: new Date().toISOString(),
      ...this.context,
      ...context,
    });
  }

  /**
   * Log performance metrics
   */
  metric(name: string, value: number, unit?: string, context?: LogContext): void {
    this.winston.info(`Metric: ${name}`, {
      logType: 'metric',
      metric: {
        name,
        value,
        unit: unit || 'count',
      },
      ...this.context,
      ...context,
    });
  }

  /**
   * Log HTTP request
   */
  logRequest(req: Request, startTime: number, context?: LogContext): void {
    const duration = Date.now() - startTime;

    this.winston.info('HTTP Request', {
      logType: 'http',
      request: {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket?.remoteAddress,
      },
      response: {
        statusCode: context?.statusCode,
        duration,
      },
      ...this.context,
      ...context,
    });
  }

  /**
   * Log database query
   */
  logQuery(query: string, duration: number, context?: LogContext): void {
    this.winston.debug('Database Query', {
      logType: 'database',
      query: {
        sql: query,
        duration,
      },
      ...this.context,
      ...context,
    });
  }

  /**
   * Log external API call
   */
  logApiCall(url: string, method: string, statusCode: number, duration: number, context?: LogContext): void {
    this.winston.info('External API Call', {
      logType: 'external_api',
      api: {
        url,
        method,
        statusCode,
        duration,
      },
      ...this.context,
      ...context,
    });
  }

  /**
   * Log security event
   */
  logSecurity(event: string, context: LogContext & {
    severity?: 'low' | 'medium' | 'high' | 'critical';
    source?: string;
    details?: any;
  }): void {
    this.winston.warn(`Security Event: ${event}`, {
      logType: 'security',
      security: {
        event,
        severity: context.severity || 'medium',
        source: context.source || 'api-gateway',
      },
      ...this.context,
      ...context,
    });
  }

  /**
   * Log business event
   */
  logBusiness(event: string, context: LogContext): void {
    this.winston.info(`Business Event: ${event}`, {
      logType: 'business',
      business: {
        event,
      },
      ...this.context,
      ...context,
    });
  }

  /**
   * Log system event
   */
  logSystem(event: string, context: LogContext): void {
    this.winston.info(`System Event: ${event}`, {
      logType: 'system',
      system: {
        event,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
      ...this.context,
      ...context,
    });
  }

  /**
   * Create child logger with additional default context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger(this.createConfigFromCurrent());
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }

  /**
   * Get Winston logger instance for advanced usage
   */
  getWinstonLogger(): winston.Logger {
    return this.winston;
  }

  /**
   * Test log levels
   */
  test(): void {
    this.debug('Debug message test');
    this.info('Info message test');
    this.warn('Warning message test');
    this.error('Error message test', new Error('Test error'));
    this.audit('Audit message test', {
      actorId: 'test_user',
      action: 'test_action',
      resourceType: 'test_resource',
      result: 'success',
    });
    this.metric('test_metric', 100, 'count');
    this.logSecurity('test_security_event', { severity: 'low' });
    this.logBusiness('test_business_event', {});
    this.logSystem('test_system_event', {});
  }
}

// Create and export logger instance
let logger: Logger;

export function initializeLogger(config: Partial<LoggerConfig> = {}): Logger {
  const defaultConfig: LoggerConfig = {
    level: process.env.LOG_LEVEL || 'info',
    silent: process.env.NODE_ENV === 'test',
    format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
    enableFile: process.env.NODE_ENV !== 'test',
    enableConsole: true,
    logDir: process.env.LOG_DIR || './logs',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
  };

  const finalConfig = { ...defaultConfig, ...config };
  logger = new Logger(finalConfig);

  // Log initialization
  logger.info('Logger initialized', {
    config: {
      level: finalConfig.level,
      format: finalConfig.format,
      enableFile: finalConfig.enableFile,
      enableConsole: finalConfig.enableConsole,
    },
  });

  return logger;
}

export function getLogger(): Logger {
  if (!logger) {
    // Initialize with default config if not already initialized
    logger = initializeLogger();
  }
  return logger;
}

// Request context middleware
export function createRequestLogger() {
  return (req: Request, res: any, next: any) => {
    const startTime = Date.now();
    const requestId = generateRequestId();

    // Add request context to logger
    const requestLogger = getLogger().withContext({
      requestId,
      method: req.method,
      url: req.url,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    // Store logger on request object for use in routes
    (req as any).logger = requestLogger;

    // Log request start
    requestLogger.info('Request started');

    // Log request completion
    res.on('finish', () => {
      requestLogger.logRequest(req, startTime, {
        statusCode: res.statusCode,
      });
    });

    next();
  };
}

// Error logging middleware
export function createErrorLogger() {
  return (error: Error, req: Request, res: any, next: any) => {
    const requestLogger = (req as any).logger || getLogger();

    requestLogger.error('Request failed', error, {
      method: req.method,
      url: req.url,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      statusCode: res.statusCode,
    });

    next(error);
  };
}

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export default logger instance
export { logger as default };
