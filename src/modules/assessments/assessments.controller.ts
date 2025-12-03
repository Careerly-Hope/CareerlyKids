// src/modules/assessments/assessments.controller.ts
// Replace the entire controller with this updated version

import { Controller, Get, Post, Body, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AssessmentsService } from './assessments.service';
import { SubmitTestDto } from './dto/submit-assessment.dto';
import { StartTestResponseDto } from './dto/start-assessment.dto';
import { TestResultDto } from './dto/assessment-result.dto';
import { FeedBackDto } from './dto/submit-feedback.dto';
import { GetResultDto } from './dto/get-results.dto';

@ApiTags('assessments')
@Controller('api/assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a new RIASEC test session' })
  @ApiResponse({
    status: 200,
    description: 'Test session created successfully',
    type: StartTestResponseDto,
  })
  async startTest() {
    return this.assessmentsService.startTest();
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit test responses and get career matches' })
  @ApiResponse({
    status: 200,
    description: 'Test submitted successfully. Use access token to view results.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        sessionToken: { type: 'string', example: 'a3f8d9e2b1c4567890abcdef' },
        message: {
          type: 'string',
          example: 'Test submitted successfully. Please provide an access token to view results.',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async submitTest(@Body() dto: SubmitTestDto) {
    // const result = await this.assessmentsService.submitTest(dto);

    // Return success but don't include results (they need token to view)
    return {
      success: true,
      sessionToken: dto.sessionToken,
      message: 'Test submitted successfully. Please provide an access token to view results.',
    };
  }

  /**
   * NEW: Get result with access token authentication
   * This is the ONLY way to view results now
   */
  @Get('result')
  @ApiOperation({
    summary: 'Get test result with access token',
    description: `
      View test results using an access token. 
      
      **First Access:** Token usage count increments (unlocking the result)
      **Subsequent Views:** Same student can review unlimited times (no additional usage charge)
      
      The token tracks which students have accessed which results.
    `,
  })
  @ApiQuery({ name: 'firstName', description: 'Student first name', example: 'John' })
  @ApiQuery({ name: 'lastName', description: 'Student last name', example: 'Doe' })
  @ApiQuery({ name: 'class', description: 'Student class/grade', example: 'Grade 10A' })
  @ApiQuery({
    name: 'accessToken',
    description: 'Access token (XXXXX-XXXX)',
    example: 'LINCO-A3F8',
  })
  @ApiQuery({ name: 'sessionToken', description: 'Session token from test submission' })
  @ApiResponse({
    status: 200,
    description: 'Test result retrieved successfully',
    type: TestResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired access token',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        reason: { type: 'string', example: 'Token has expired' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Test result not found',
  })
  async getResult(@Query() dto: GetResultDto) {
    return this.assessmentsService.getResultWithToken(dto);
  }

  /**
   * Get detailed usage report for an access token
   * Shows all students who have unlocked results
   */
  @Get('token-report/:token')
  @ApiOperation({
    summary: 'Get token usage report',
    description:
      'Shows all students who have used this token to unlock results. Useful for school admins.',
  })
  @ApiParam({
    name: 'token',
    description: 'Access token',
    example: 'LINCO-A3F8',
  })
  @ApiResponse({
    status: 200,
    description: 'Token usage report',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', example: 'LINCO-A3F8' },
        school: { type: 'string', example: 'Lincoln High School' },
        type: { type: 'string', example: 'ENTERPRISE' },
        status: { type: 'string', example: 'ACTIVE' },
        usageCount: { type: 'number', example: 3 },
        maxUsage: { type: 'number', example: 10 },
        remainingUsage: { type: 'number', example: 7 },
        totalStudents: { type: 'number', example: 3 },
        totalViews: { type: 'number', example: 8 },
        students: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'John Doe' },
              class: { type: 'string', example: 'Grade 10A' },
              sessionToken: { type: 'string' },
              unlockedAt: { type: 'string', example: '2025-12-03T10:30:00Z' },
              lastViewedAt: { type: 'string', example: '2025-12-03T15:45:00Z' },
              viewCount: { type: 'number', example: 3 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Token not found' })
  async getTokenReport(@Param('token') token: string) {
    return this.assessmentsService.getTokenUsageReport(token);
  }

  /**
   * Get usage analytics grouped by class
   */
  @Get('token-report/:token/by-class')
  @ApiOperation({
    summary: 'Get token usage by class',
    description: 'Shows usage statistics grouped by student class/grade',
  })
  @ApiParam({ name: 'token', description: 'Access token' })
  @ApiResponse({
    status: 200,
    description: 'Usage by class',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        school: { type: 'string' },
        classes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              class: { type: 'string', example: 'Grade 10A' },
              studentsUnlocked: { type: 'number', example: 5 },
              totalViews: { type: 'number', example: 12 },
            },
          },
        },
      },
    },
  })
  async getUsageByClass(@Param('token') token: string) {
    return this.assessmentsService.getUsageByClass(token);
  }

  @Post('feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Provide feedback and rating of results' })
  @ApiResponse({
    status: 200,
    description: 'Feedback submitted successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Result not found' })
  async submitFeedback(@Body() dto: FeedBackDto) {
    return this.assessmentsService.submitFeedback(dto);
  }
}
