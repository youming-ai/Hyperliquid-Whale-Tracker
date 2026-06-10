import type { Request } from 'express';

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

const LOG_LEVELS: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

class Logger {
  private level: number;
  private context: LogContext = {};
  private silent: boolean;

  constructor(config: LoggerConfig) {
    this.level = LOG_LEVELS[config.level] ?? LOG_LEVELS.info;
    this.silent = config.silent;
  }

  private shouldLog(level: string): boolean {
    if (this.silent) return false;
    return (LOG_LEVELS[level] ?? LOG_LEVELS.info) <= this.level;
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
  }

  private log(level: string, message: string, meta?: any): void {
    if (!this.shouldLog(level)) return;
    const formatted = this.formatMessage(level, message, { ...this.context, ...meta });
    
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  getContext(): LogContext {
    return { ...this.context };
  }

  withContext(context: LogContext): Logger {
    const logger = new Logger({
      level: Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === this.level) || 'info',
      silent: this.silent,
      format: 'json',
      enableFile: false,
      enableConsole: true,
    });
    logger.setContext({ ...this.context, ...context });
    return logger;
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorMeta = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    } : {};
    this.log('error', message, { ...context, ...errorMeta });
  }

  audit(
    message: string,
    context: LogContext & {
      actorId?: string;
      action: string;
      resourceType?: string;
      resourceId?: string;
      oldValues?: any;
      newValues?: any;
      result?: 'success' | 'failure';
    },
  ): void {
    this.log('info', `[AUDIT] ${message}`, { logType: 'audit', ...context });
  }

  metric(name: string, value: number, unit?: string, context?: LogContext): void {
    this.log('info', `Metric: ${name}`, {
      logType: 'metric',
      metric: { name, value, unit: unit || 'count' },
      ...context,
    });
  }

  logRequest(req: Request, startTime: number, context?: LogContext): void {
    const duration = Date.now() - startTime;
    this.log('info', 'HTTP Request', {
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
      ...context,
    });
  }

  logQuery(query: string, duration: number, context?: LogContext): void {
    this.log('debug', 'Database Query', {
      logType: 'database',
      query: { sql: query, duration },
      ...context,
    });
  }

  logApiCall(url: string, method: string, statusCode: number, duration: number, context?: LogContext): void {
    this.log('info', 'External API Call', {
      logType: 'external_api',
      api: { url, method, statusCode, duration },
      ...context,
    });
  }

  logSecurity(event: string, context: LogContext & { severity?: 'low' | 'medium' | 'high' | 'critical'; source?: string; details?: any }): void {
    this.log('warn', `Security Event: ${event}`, {
      logType: 'security',
      security: {
        event,
        severity: context.severity || 'medium',
        source: context.source || 'api-gateway',
      },
      ...context,
    });
  }

  logBusiness(event: string, context: LogContext): void {
    this.log('info', `Business Event: ${event}`, {
      logType: 'business',
      business: { event },
      ...context,
    });
  }

  logSystem(event: string, context: LogContext): void {
    this.log('info', `System Event: ${event}`, {
      logType: 'system',
      system: {
        event,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
      ...context,
    });
  }

  child(context: LogContext): Logger {
    const childLogger = new Logger({
      level: Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === this.level) || 'info',
      silent: this.silent,
      format: 'json',
      enableFile: false,
      enableConsole: true,
    });
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }

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
    enableFile: false,
    enableConsole: true,
    logDir: process.env.LOG_DIR || './logs',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
  };

  const finalConfig = { ...defaultConfig, ...config };
  logger = new Logger(finalConfig);

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
    logger = initializeLogger();
  }
  return logger;
}

// Request context middleware
export function createRequestLogger() {
  return (req: Request, res: any, next: any) => {
    const startTime = Date.now();
    const requestId = generateRequestId();

    const requestLogger = getLogger().withContext({
      requestId,
      method: req.method,
      url: req.url,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    (req as any).logger = requestLogger;
    requestLogger.info('Request started');

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
export { logger as default, logger };
