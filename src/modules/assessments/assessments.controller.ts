//src/modules/assessments/controller.module.ts
import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AssessmentsService } from './assessments.service';
import { SubmitTestDto } from './dto/submit-assessment.dto';
import { StartTestResponseDto } from './dto/start-assessment.dto';
import { TestResultDto } from './dto/assessment-result.dto';
import { FeedBackDto } from './dto/submit-feedback.dto';

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
    description: 'Test results with career matches',
    type: TestResultDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async submitTest(@Body() dto: SubmitTestDto) {
    return this.assessmentsService.submitTest(dto);
  }

  @Get('result/:sessionToken')
  @ApiOperation({ summary: 'Get test result by session token' })
  @ApiParam({ name: 'sessionToken', description: 'Session token' })
  @ApiResponse({
    status: 200,
    description: 'Test result retrieved',
    type: TestResultDto,
  })
  @ApiResponse({ status: 404, description: 'Result not found' })
  async getResult(@Param('sessionToken') sessionToken: string) {
    return this.assessmentsService.getResult(sessionToken);
  }


// src/modules/assessments/controller.module.ts
// Replace your feedback endpoint with this corrected version

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
