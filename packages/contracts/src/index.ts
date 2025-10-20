// Main tRPC router and middleware exports
export { router, publicProcedure, protectedProcedure, kycProcedure } from './trpc';
export { createAuthMiddleware } from './middleware/auth';
export { createRateLimitMiddleware } from './middleware/rateLimit';
export { createValidationMiddleware } from './middleware/validation';
export {
  HyperDashError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  handleDatabaseError
} from './utils/errors';
export { createContext, type Context, type AsyncContext } from './types';

// Router exports
export { marketRouter } from './routers/market';
// Additional routers will be exported here as they are created
