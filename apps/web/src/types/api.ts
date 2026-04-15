/**
 * tRPC API Router Types
 *
 * This file defines the AppRouter type for the frontend.
 * The actual router is defined in apps/api-gateway/src/routes/index.ts
 *
 * TODO: Either export AppRouter from @hyperdash/contracts or generate types from API
 */

// For now, use `any` to bypass type checking since we don't have the AppRouter type
// In production, you'd want to either:
// 1. Export AppRouter from @hyperdash/contracts
// 2. Use tRPC type generation with `npx @trpc/client typegen`
// 3. Create a shared types package

export type AppRouter = any;
