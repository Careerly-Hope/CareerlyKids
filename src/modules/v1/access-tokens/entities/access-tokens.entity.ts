// src/modules/access-tokens/entities/access-token.entity.ts
import { AccessToken, TokenType, TokenStatus, PaymentStatus } from '@prisma/client';

export { AccessToken, TokenType, TokenStatus, PaymentStatus };

// Additional types for service responses
export interface TokenValidationResult {
  valid: boolean;
  token?: AccessToken;
  reason?: string;
}

export interface TokenGenerationResult {
  success: boolean;
  tokenId: string;
  token: string;
  expiresAt: Date;
  maxUsage: number;
  message: string;
}
