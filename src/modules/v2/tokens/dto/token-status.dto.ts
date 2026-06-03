import { ApiProperty } from '@nestjs/swagger';
import { TokenType } from '@prisma/client';

// src/modules/access-tokens/dto/token-status.dto.ts
export class TokenStatusDto {
  @ApiProperty({ description: 'Token ID' })
  id: string;

  @ApiProperty({ description: 'Token string' })
  token: string;

  @ApiProperty({ description: 'Token type', enum: TokenType })
  type: TokenType;

  @ApiProperty({ description: 'Token status' })
  status: string;

  @ApiProperty({ description: 'Usage count' })
  usageCount: number;

  @ApiProperty({ description: 'Maximum usage allowed' })
  maxUsage: number;

  @ApiProperty({ description: 'Token expiration date' })
  expiresAt: Date;

  @ApiProperty({ description: 'Token creation date' })
  createdAt: Date;
}
