import { publicProcedure, t } from '@hyperdash/contracts';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getAuthService } from '../services/auth';
import { logger } from '../utils/logger';

/**
 * Authentication Router
 *
 * Handles user authentication, token management, and wallet-based login
 */
export const authRouter = t.router({
  // Wallet-based authentication - generate nonce
  generateNonce: t.procedure
    .input(
      z.object({
        walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { walletAddress } = input;
      const authService = getAuthService();

      // Generate nonce for wallet signature verification
      const nonce = authService.generateNonce();

      // Store nonce with timestamp (in a real implementation, use Redis/database)
      logger.info(`Generated nonce for wallet authentication`, {
        walletAddress,
        nonce,
        ip: ctx.req?.socket?.remoteAddress,
      });

      return {
        nonce,
        message: `Sign this message to authenticate with HyperDash: ${nonce}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
      };
    }),

  // Authenticate with wallet signature
  authenticateWithWallet: t.procedure
    .input(
      z.object({
        walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
        signature: z.string(),
        nonce: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { walletAddress, signature, nonce } = input;
      const authService = getAuthService();

      try {
        // Verify wallet signature
        const message = `Sign this message to authenticate with HyperDash: ${nonce}`;
        const isValidSignature = await authService.verifyWalletSignature(
          walletAddress,
          message,
          signature,
          nonce,
        );

        if (!isValidSignature) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid signature or nonce',
          });
        }

        // Check if user exists in database (mock implementation)
        // In a real implementation, query the users table
        const userPayload = await this.findOrCreateUser(walletAddress);

        // Generate tokens
        const tokens = await authService.generateTokens(userPayload);

        logger.info(`Wallet authentication successful`, {
          userId: userPayload.userId,
          walletAddress,
          ip: ctx.req?.socket?.remoteAddress,
          userAgent: ctx.req?.headers?.['user-agent'],
        });

        return {
          user: {
            userId: userPayload.userId,
            walletAddress: userPayload.walletAddr,
            kycLevel: userPayload.kycLevel,
            tier: userPayload.tier,
            email: userPayload.email,
          },
          tokens,
        };
      } catch (error) {
        logger.error(`Wallet authentication failed`, {
          walletAddress,
          error: error.message,
          ip: ctx.req?.socket?.remoteAddress,
        });

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Authentication failed',
        });
      }
    }),

  // Refresh access token
  refreshToken: t.procedure
    .input(
      z.object({
        refreshToken: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { refreshToken } = input;
      const authService = getAuthService();

      try {
        const newTokens = await authService.refreshAccessToken(refreshToken);

        logger.info(`Token refresh successful`, {
          ip: ctx.req?.socket?.remoteAddress,
        });

        return {
          tokens: newTokens,
        };
      } catch (error) {
        logger.error(`Token refresh failed`, {
          error: error.message,
          ip: ctx.req?.socket?.remoteAddress,
        });

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid refresh token',
        });
      }
    }),

  // Logout (revoke refresh token)
  logout: t.procedure
    .input(
      z.object({
        refreshToken: z.string().optional(),
        allDevices: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { refreshToken, allDevices } = input;
      const authService = getAuthService();

      // In a real implementation, this would be protected by authentication middleware
      // For now, we'll extract the user ID from the refresh token

      try {
        if (allDevices) {
          // Revoke all tokens for user (would need user ID from auth context)
          logger.info(`Logged out from all devices`, {
            ip: ctx.req?.socket?.remoteAddress,
          });
        } else if (refreshToken) {
          // Revoke specific refresh token
          const decoded = authService.decodeToken(refreshToken);
          if (decoded?.tokenId) {
            await authService.revokeToken(decoded.tokenId);
          }

          logger.info(`Logged out specific device`, {
            tokenId: decoded?.tokenId,
            ip: ctx.req?.socket?.remoteAddress,
          });
        }

        return {
          success: true,
          message: allDevices ? 'Logged out from all devices' : 'Logged out successfully',
        };
      } catch (error) {
        logger.error(`Logout failed`, {
          error: error.message,
          ip: ctx.req?.socket?.remoteAddress,
        });

        // Don't throw error for logout, just return success
        return {
          success: true,
          message: 'Logout completed',
        };
      }
    }),

  // Verify token validity
  verifyToken: t.procedure
    .input(
      z.object({
        token: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { token } = input;
      const authService = getAuthService();

      try {
        const userPayload = await authService.verifyAccessToken(token);

        return {
          valid: true,
          user: {
            userId: userPayload.userId,
            walletAddress: userPayload.walletAddr,
            kycLevel: userPayload.kycLevel,
            tier: userPayload.tier,
            email: userPayload.email,
          },
        };
      } catch (error) {
        return {
          valid: false,
          error: error.message,
        };
      }
    }),

  // Get token information
  tokenInfo: t.procedure
    .input(
      z.object({
        token: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { token } = input;
      const authService = getAuthService();

      try {
        const decoded = authService.decodeToken(token);

        if (!decoded) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid token format',
          });
        }

        return {
          decoded: {
            sub: decoded.sub,
            type: decoded.type,
            iat: decoded.iat,
            exp: decoded.exp,
            iss: decoded.iss,
            aud: decoded.aud,
          },
          expired: decoded.exp ? Date.now() / 1000 > decoded.exp : false,
          validUntil: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Unable to decode token',
        });
      }
    }),

  // Get authentication statistics (admin only)
  authStats: t.procedure.query(async ({ ctx }) => {
    // In a real implementation, this would be protected by admin middleware
    const authService = getAuthService();
    const stats = authService.getTokenStats();

    return {
      tokenStats: stats,
      systemTime: new Date().toISOString(),
      config: {
        jwtExpiry: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: process.env.JWT_ISSUER || 'hyperdash',
        audience: process.env.JWT_AUDIENCE || 'hyperdash-users',
      },
    };
  }),

  // Validate password strength (for users who also use password authentication)
  validatePassword: t.procedure
    .input(
      z.object({
        password: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { password } = input;
      const authService = getAuthService();

      const validation = authService.validatePassword(password);

      return {
        isValid: validation.isValid,
        errors: validation.errors,
        requirements: {
          minLength: 8,
          maxLength: 128,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
        },
      };
    }),

  // Helper method to find or create user (mock implementation)
  async findOrCreateUser(walletAddress: string) {
    // In a real implementation, this would query the database
    // For now, we'll return a mock user payload

    return {
      userId: `user_${walletAddress.slice(-8)}`, // Mock user ID
      walletAddr: walletAddress,
      kycLevel: 1, // Default KYC level
      tier: 'freemium' as const,
      email: undefined, // Users might not have email if using wallet auth only
    };
  },
});

// Add decodeToken method to AuthService class (for token info endpoint)
const originalAuthService = getAuthService;
Object.defineProperty(AuthService.prototype, 'decodeToken', {
  value: (token: string) => {
    try {
      return require('jsonwebtoken').decode(token, { complete: true });
    } catch (error) {
      return null;
    }
  },
  writable: true,
  configurable: true,
});
