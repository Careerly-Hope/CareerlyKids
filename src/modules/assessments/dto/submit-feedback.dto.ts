//src/modules/assessments/dto/submit-assessment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Max, Min } from 'class-validator';

export class FeedBackDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
    description: 'Session token from test submission',
  })
  @IsString()
  sessionToken: string;  // Changed from resultId

  @ApiProperty({
    example: 'I was satisfied with the results',
    description: 'Your feedback on the test results',
  })
  @IsString()
  feedback: string;

  @ApiProperty({
    example: 4,
    description: 'Rating for the test results (1-5 scale)',
  })
  @IsNumber()
  @Max(5)
  @Min(1)
  rating: number;
}
