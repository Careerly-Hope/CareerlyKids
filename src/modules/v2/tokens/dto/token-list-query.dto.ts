import { ApiProperty } from "@nestjs/swagger";
import { TokenStatus, TokenType } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export class TokenListQueryDto {
    @ApiProperty({
      description: 'Filter by token type',
      enum: ['INDIVIDUAL', 'ENTERPRISE'],
      required: false,
    })
    @IsOptional()
    @IsEnum(TokenType)
    type?: TokenType;
  
    @ApiProperty({
      description: 'Filter by status',
      enum: ['ACTIVE', 'USED', 'EXPIRED', 'REVOKED'],
      required: false,
    })
    @IsOptional()
    @IsEnum(TokenStatus)
    status?: TokenStatus;
  
    @ApiProperty({ description: 'Page number', default: 1, minimum: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number = 1;
  
    @ApiProperty({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max
    (100)
    limit?: number = 20;
  }