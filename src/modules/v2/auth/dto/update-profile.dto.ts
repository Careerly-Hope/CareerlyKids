import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+237612345678' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '2008-04-12T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'Grade 10' })
  @IsOptional()
  @IsString()
  grade?: string;

  @ApiPropertyOptional({ example: 'Government High School' })
  @IsOptional()
  @IsString()
  school?: string;

  @ApiPropertyOptional({ example: 'I love science and robotics.' })
  @IsOptional()
  @IsString()
  bio?: string;
}
