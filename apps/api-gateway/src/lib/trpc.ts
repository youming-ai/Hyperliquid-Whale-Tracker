import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';

const t = initTRPC.create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error instanceof ZodError ? error.issues : null,
      },
    };
  },
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
