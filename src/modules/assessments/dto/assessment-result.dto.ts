// src/modules/assessments/dto/assessment-result.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class CareerMatchDto {
  @ApiProperty({ example: 1 })
  careerId: number;

  @ApiProperty({ example: 'School Psychologist' })
  careerName: string;

  @ApiProperty({ example: 'Help students with learning and behavioral issues' })
  description: string;

  @ApiProperty({
    example: { R: 15, I: 30, A: 25, S: 40, E: 20, C: 10 },
  })
  profile: Record<string, number>;

  @ApiProperty({ example: 4 })
  jobZone: number;

  @ApiProperty({ example: ['education', 'psychology'] })
  tags: string[];

  @ApiProperty({ example: 0.856, description: 'Correlation coefficient' })
  correlation: number;

  @ApiProperty({ example: 'BEST_FIT', enum: ['BEST_FIT', 'GREAT_FIT', 'GOOD_FIT'] })
  matchType: string;
}

export class MatchStatisticsDto {
  @ApiProperty({ example: 10 })
  total: number;

  @ApiProperty({ example: 3 })
  bestFit: number;

  @ApiProperty({ example: 4 })
  greatFit: number;

  @ApiProperty({ example: 3 })
  goodFit: number;

  @ApiProperty({ example: 0.742 })
  avgCorrelation: number;
}

// ✅ NEW: Stream recommendation DTO
export class StreamRecommendationDto {
  @ApiProperty({
    example: 'Science',
    enum: ['Art', 'Science', 'Commercial'],
    description: 'Recommended academic stream',
  })
  recommendedStream: 'Art' | 'Science' | 'Commercial';

  @ApiProperty({
    example:
      'Based on your high Investigative and Realistic scores, Science stream is the best fit. Your interest in problem-solving and technical work aligns perfectly with subjects like Physics, Chemistry, and Mathematics.',
    description: 'Explanation for the recommendation',
  })
  reasoning: string;

  @ApiProperty({
    example: { art: 65, science: 85, commercial: 45 },
    description: 'Alignment scores for each stream (0-100)',
  })
  streamAlignment: {
    art: number;
    science: number;
    commercial: number;
  };
}

export class TestResultDto {
  @ApiProperty({ example: 'abc-123-def-456' })
  resultId: string;

  @ApiProperty({ example: 'SIA' })
  careerCode: string;

  @ApiProperty({
    example: { R: 24, I: 30, A: 20, S: 34, E: 12, C: 10 },
  })
  scores: Record<string, number>;

  @ApiProperty({ example: 130 })
  totalScore: number;

  @ApiProperty({ example: 'Innovator' })
  tier: string;

  @ApiProperty({ type: [CareerMatchDto] })
  matches: CareerMatchDto[];

  @ApiProperty({ type: MatchStatisticsDto })
  statistics: MatchStatisticsDto;

  @ApiProperty({ type: StreamRecommendationDto }) // ✅ NEW
  streamRecommendation: StreamRecommendationDto;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  submittedAt: string;
}
