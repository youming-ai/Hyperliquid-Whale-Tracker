// Main tRPC router and middleware exports

// Re-export AppRouter type from API Gateway
// Note: In development, this type is imported from the built API gateway
// In production with monorepo, this would be imported directly from the API gateway package
export type { AppRouter } from '@hyperdash/api-gateway';
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
