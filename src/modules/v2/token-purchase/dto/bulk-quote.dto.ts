import { IsInt, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BulkQuoteDto {
  @ApiProperty({ example: 50 })
  @IsInt()
  @Type(() => Number)
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 'Lincoln High School' })
  @IsString()
  school: string;
}
