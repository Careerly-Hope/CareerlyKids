import { IsString, IsNotEmpty, IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminSendResultsDto {
  @ApiProperty({
    description: 'Session token from test submission',
    example: 'a3f8d9e2b1c4567890abcdef12345678...',
  })
  @IsString()
  @IsNotEmpty()
  sessionToken: string;

  @ApiProperty({
    description: 'Recipient email address',
    example: 'parent@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  recipientEmail: string;

  @ApiProperty({
    description: 'Student name for email',
    example: 'John Doe',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  studentName: string;

  @ApiProperty({
    description: 'Student class/grade',
    example: 'Grade 10A',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  studentClass: string;

  @ApiProperty({
    description: 'School name (optional)',
    example: 'Lincoln High School',
    required: false,
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  school?: string;
}
