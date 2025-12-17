import { IsEmail, IsString, IsNotEmpty, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PurchaseBulkTokenDto {
  @ApiProperty({ example: 'admin@school.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'School Administrator' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Lincoln High School' })
  @IsString()
  @IsNotEmpty()
  school: string;

  @ApiProperty({ example: 'eg.for jss3A' })
  @IsString()
  @IsNotEmpty()
  desc: string;

  @ApiProperty({ example: 50, minimum: 1 })
  @IsInt()
  @Type(() => Number)
  @Min(1)
  quantity: number;
}