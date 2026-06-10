import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { Context } from '@hyperdash/contracts';

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

// Simple rate limit middleware placeholder
const rateLimitMiddleware = async ({ ctx, next }: { ctx: any; next: any }) => {
  return next({ ctx });
};

// Simple validation middleware placeholder
const validationMiddleware = async ({ ctx, next }: { ctx: any; next: any }) => {
  return next({ ctx });
};

// Define procedures
export const publicProcedure = t.procedure;
export const authMiddleware = async ({ ctx, next }: { ctx: any; next: any }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
};

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
