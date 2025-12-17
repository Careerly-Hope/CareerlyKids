import { ApiProperty } from "@nestjs/swagger";
import { TokenType } from "@prisma/client";
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export class AdminGenerateTokenDto {
    @ApiProperty({
      description: 'Token type',
      enum: ['INDIVIDUAL', 'ENTERPRISE'],
    })
    @IsEnum(TokenType)
    type: TokenType;
  
    @ApiProperty({
      description: 'Email to send token to',
      example: 'recipient@example.com',
    })
    @IsEmail()
    email: string;
  
    @ApiProperty({
      description: 'Recipient name',
      example: 'Test User',
    })
    @IsString()
    name: string;
  
    @ApiProperty({
      description: 'School name (required for ENTERPRISE)',
      required: false,
    })
    @IsOptional()
    @IsString()
    school?: string;
  
    @ApiProperty({
      description: 'Max usage (required for ENTERPRISE)',
      required: false,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    maxUsage?: number;
  
    @ApiProperty({
      description: 'Assign to specific user (clerkId)',
      required: false,
    })
    @IsOptional()
    @IsString()
    assignToUserId?: string;
  }