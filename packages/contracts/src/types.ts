import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone';

export interface AuthContext {
  userId: string;
  walletAddr: string;
  kycLevel: number;
}

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  user?: AuthContext | null;
  validatedInput?: any;
}

export interface Context extends RequestContext {
  req?: any; // Request object
  res?: any; // Response object
}

export type CreateContextOptions = CreateHTTPContextOptions<Request, Response>;

export function createContext(opts?: CreateContextOptions): Context {
  return {
    ip: (opts?.req?.headers['x-forwarded-for'] as string) || opts?.req?.socket?.remoteAddress,
    userAgent: opts?.req?.headers['user-agent'],
    req: opts?.req,
    res: opts?.res,
  };
}

export type AsyncContext = inferAsyncReturnType<typeof createContext>;
