import type { Context } from '@hyperdash/contracts';
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

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

// Middleware type: tRPC's MiddlewareFunction expects next() to return MiddlewareResult,
// not a plain Context object. Using 'any' here is necessary to satisfy tRPC's complex
// generic constraints until explicit types are derived from the initTRPC instance.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MiddlewareOpts = { ctx: any; next: any };

const rateLimitMiddleware = async ({ ctx, next }: MiddlewareOpts) => {
  return next({ ctx });
};

const validationMiddleware = async ({ ctx, next }: MiddlewareOpts) => {
  return next({ ctx });
};

export const publicProcedure = t.procedure;
export const authMiddleware = async ({ ctx, next }: MiddlewareOpts) => {
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
