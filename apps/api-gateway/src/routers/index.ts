import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { Context } from '../context';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { validationMiddleware } from '../middleware/validation';

// Initialize tRPC
export const t = initTRPC.context<Context>().create({
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError:
        error.code === 'BAD_REQUEST' && error.cause instanceof z.ZodError
          ? error.cause.flatten()
          : null,
    },
  }),
});

// Define procedures
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(authMiddleware);
export const rateLimitedProcedure = t.procedure.use(rateLimitMiddleware);
export const validatedProcedure = t.procedure.use(validationMiddleware);

// Combine middleware
export const authenticatedRateLimitedProcedure = t.procedure
  .use(authMiddleware)
  .use(rateLimitMiddleware);

export const authenticatedValidatedProcedure = t.procedure
  .use(authMiddleware)
  .use(validationMiddleware);

// Router creation helper
export const createRouter = t.router;
