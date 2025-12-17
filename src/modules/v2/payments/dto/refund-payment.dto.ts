// src/modules/v2/payments/dto/refund-payment.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class RefundPaymentDto {
  @ApiProperty({
    description: 'Reason for refund',
    example: 'Customer requested refund',
  })
  @IsString()
  reason: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
