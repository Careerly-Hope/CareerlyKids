import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

// src/modules/access-tokens/dto/validate-token.dto.ts
export class ValidateTokenDto {
  @ApiProperty({
    description: 'Access token to validate',
    example: 'ASMT-a3f8d9e2b1c4567890abcdef12345678-lz3x9k2-A3F8',
  })
  @IsString()
  token: string;
}
