// Main tRPC router and middleware exports

// Note: AppRouter should be imported directly from @hyperdash/api-gateway when needed
export { createAuthMiddleware } from './middleware/auth';
export { createRateLimitMiddleware } from './middleware/rateLimit';
export { createValidationMiddleware } from './middleware/validation';
// Router exports
export { marketRouter } from './routers/market';
export {
  kycProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from './trpc';
export { default as t } from './trpc';
export { type AsyncContext, type Context, createContext } from './types';
export {
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  ExternalServiceError,
  HyperDashError,
  handleDatabaseError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from './utils/errors';

// Additional routers will be exported here as they are created
