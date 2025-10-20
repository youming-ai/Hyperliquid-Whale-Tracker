import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { AsyncContext } from './types';
import { z } from 'zod';

export interface Context {
  user?: {
    userId: string;
    walletAddr: string;
    kycLevel: number;
  } | null;
  ip?: string;
  userAgent?: string;
}

const t = initTRPC.context<AsyncContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.code === 'BAD_REQUEST' && error.cause instanceof z.ZodError
        ? error.cause.flatten()
        : null,
    },
  }),
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const kycProcedure = (minLevel: number) => t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (ctx.user.kycLevel < minLevel) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `KYC level ${minLevel} required`
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export default t;
