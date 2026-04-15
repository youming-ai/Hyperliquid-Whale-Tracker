import { QueryClient } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCClient, createTRPCReact } from '@trpc/react-query';
import superjson from 'superjson';
import type { AppRouter } from '@/types/api';

/**
 * API base URL
 */
const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/trpc`;

/**
 * Create tRPC client for use without React (server-side)
 */
export function createPlainTRPCClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: API_URL,
        transformer: superjson,
      }),
    ],
  });
}

/**
 * React hooks for tRPC
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Query client for React Query
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * tRPC client configuration for use with Provider
 */
export const trpcClientConfig = {
  links: [
    httpBatchLink({
      url: API_URL,
      transformer: superjson,
    }),
  ],
};

// Type helpers
export type RouterNames = keyof AppRouter['_def']['procedures'];
