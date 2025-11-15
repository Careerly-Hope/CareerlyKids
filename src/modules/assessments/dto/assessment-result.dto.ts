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

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  submittedAt: string;
}
