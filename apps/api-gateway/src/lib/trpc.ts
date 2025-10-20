import { initTRPC } from '@trpc/server';
import { ZodError } from 'zod';
import superjson from 'superjson';

const t = initTRPC.create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error instanceof ZodError
            ? error.issues
            : null,
      },
    };
  },
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
