// src/modules/v2/token-purchase/dto/guest-purchase-individual.dto.ts
import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GuestPurchaseIndividualTokenDto {
  @ApiProperty({
    description: 'Email to receive token and results',
    example: 'guest@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Name of purchaser',
    example: 'John Doe',
  })
  @IsString()
  name: string;
}