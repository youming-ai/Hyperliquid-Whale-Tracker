# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy lockfile and workspace config
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./

# Copy all workspace package.json files for dependency resolution
COPY apps/api-gateway/package.json ./apps/api-gateway/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy lockfile and workspace config
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./

# Copy all workspace package.json files for dependency resolution
COPY apps/api-gateway/package.json ./apps/api-gateway/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
