// src/modules/access-tokens/dto/generate-token.dto.ts
import { IsEmail, IsString, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TokenType } from '@prisma/client';

export class GenerateTokenDto {
  @ApiProperty({
    description: 'Email address to send the token to',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Name of the person receiving the token',
    example: 'John Doe',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'School name (required for ENTERPRISE tokens, optional for INDIVIDUAL)',
    example: 'Stanford University',
    required: false,
  })
  @IsOptional()
  @IsString()
  school?: string;

  @ApiProperty({
    description: 'Type of token: INDIVIDUAL (1 use, 30 days) or ENTERPRISE (custom usage, 1 year)',
    enum: TokenType,
    example: TokenType.INDIVIDUAL,
  })
  @IsEnum(TokenType)
  type: TokenType;

  @ApiProperty({
    description:
      'Maximum usage count for ENTERPRISE tokens (required for ENTERPRISE, ignored for INDIVIDUAL)',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsage?: number;
}
