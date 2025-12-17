import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNumber, Min, IsOptional, IsIn } from 'class-validator';

export class InitializePaymentDto {
  @ApiProperty({
    description: 'Amount in Naira (will be converted to kobo)',
    example: 5000,
  })
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({
    description: 'Customer email',
    example: 'customer@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Token type',
    enum: ['INDIVIDUAL', 'BULK'],
    example: 'INDIVIDUAL',
  })
  @IsIn(['INDIVIDUAL', 'BULK'])
  tokenType: 'INDIVIDUAL' | 'BULK';

  @ApiProperty({
    description: 'Quantity of tokens (1 for individual)',
    example: 1,
  })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Name for token recipient',
    example: 'John Doe',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'School name (required for bulk tokens)',
    required: false,
    example: 'Harvard High School',
  })
  @IsOptional()
  @IsString()
  school?: string;
}
