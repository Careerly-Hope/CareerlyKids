import { ApiProperty } from '@nestjs/swagger';
import { TokenType } from '@prisma/client';

// src/modules/access-tokens/dto/token-response.dto.ts
export class TokenResponseDto {
  @ApiProperty({ description: 'Operation success status' })
  success: boolean;

  @ApiProperty({ description: 'Token ID' })
  tokenId: string;

  @ApiProperty({ description: 'Generated access token' })
  token: string;

  @ApiProperty({ description: 'Token expiration date' })
  expiresAt: Date;

  @ApiProperty({ description: 'max Usage' })
  maxUsage: number;

  @ApiProperty({ description: 'Response message' })
  message: string;
}

// src/modules/access-tokens/dto/validation-response.dto.ts
export class ValidationResponseDto {
  @ApiProperty({ description: 'Whether the token is valid' })
  valid: boolean;

  @ApiProperty({ description: 'Token type', enum: TokenType, required: false })
  type?: TokenType;

  @ApiProperty({ description: 'Remaining usage count', required: false })
  remainingUsage?: number;

  @ApiProperty({ description: 'Token expiration date', required: false })
  expiresAt?: Date;

  @ApiProperty({ description: 'Reason for invalid token', required: false })
  reason?: string;
}
