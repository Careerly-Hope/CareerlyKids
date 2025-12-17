// src/modules/assessments/dto/get-result.dto.ts
import { IsString, IsNotEmpty, MaxLength, MinLength, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetResultDto {
  @ApiProperty({
    description: 'Student first name',
    example: 'John',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({
    description: 'Student last name',
    example: 'Doe',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({
    description: 'Student class/grade',
    example: 'Grade 10A',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  class: string;

  @ApiProperty({
    description: 'Access token (9 characters: XXXXX-XXXX)',
    example: 'LINCO-A3F8',
    minLength: 9,
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(9)
  @MaxLength(10)
  accessToken: string;

  @ApiProperty({
    description: 'Session token from test submission',
    example: 'a3f8d9e2b1c4567890abcdef12345678...',
  })
  @IsString()
  @IsNotEmpty()
  sessionToken: string;

  @ApiProperty({
    description: 'Parent/Guardian email address to receive results (optional)',
    example: 'parent@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  parentEmail?: string;
}