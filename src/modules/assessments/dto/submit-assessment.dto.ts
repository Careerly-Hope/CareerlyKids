import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SCORE_CONSTRAINTS } from '../../scoring/constants/scoring.constants';

export class QuestionResponseDto {
  @ApiProperty({ example: 1, description: 'Question ID' })
  @IsInt()
  @Min(1)
  questionId: number;

  @ApiProperty({
    example: 4,
    description: 'Score (1-5 scale)',
    minimum: SCORE_CONSTRAINTS.MIN_SCORE,
    maximum: SCORE_CONSTRAINTS.MAX_SCORE,
  })
  @IsInt()
  @Min(SCORE_CONSTRAINTS.MIN_SCORE)
  @Max(SCORE_CONSTRAINTS.MAX_SCORE)
  score: number;
}

export class JobPreferencesDto {
  @ApiProperty({
    required: false,
    example: [3, 4, 5],
    description: 'Preferred job zones (education levels)',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  preferredJobZones?: number[];

  @ApiProperty({
    required: false,
    example: ['creative', 'technology'],
    description: 'Preferred career tags',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredTags?: string[];


  [key: string]: any; 


  @ApiProperty({
    required: false,
    example: ['outdoor'],
    description: 'Tags to exclude',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeTags?: string[];

  @ApiProperty({ required: false, example: 2, description: 'Minimum job zone' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  minJobZone?: number;

  @ApiProperty({ required: false, example: 5, description: 'Maximum job zone' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxJobZone?: number;
}

export class SubmitTestDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Session token from /test/start',
  })
  @IsString()
  sessionToken: string;

  @ApiProperty({
    type: [QuestionResponseDto],
    description: `Array of ${SCORE_CONSTRAINTS.TOTAL_QUESTIONS} question responses`,
  })
  @IsArray()
  @ArrayMinSize(SCORE_CONSTRAINTS.TOTAL_QUESTIONS)
  @ArrayMaxSize(SCORE_CONSTRAINTS.TOTAL_QUESTIONS)
  @ValidateNested({ each: true })
  @Type(() => QuestionResponseDto)
  responses: QuestionResponseDto[];

  @ApiProperty({
    required: false,
    type: JobPreferencesDto,
    description: 'Optional job preferences to filter results',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => JobPreferencesDto)
  jobPreferences?: JobPreferencesDto;
}