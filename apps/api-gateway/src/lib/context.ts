import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import jwt from 'jsonwebtoken';

export type Context = inferAsyncReturnType<typeof createContext>;

export async function createContext(opts?: CreateExpressContextOptions) {
  async function getUserFromHeader() {
    if (opts?.req.headers.authorization) {
      try {
        const token = opts.req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        return decoded;
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  const user = await getUserFromHeader();

  return {
    user,
    req: opts?.req,
  };
}
