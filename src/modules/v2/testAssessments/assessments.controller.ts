// src/modules/assessments/assessments.controller.ts
import { Controller, Get, Post, Body, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AssessmentsService } from './assessments.service';
import { SubmitTestDto } from './dto/submit-assessment.dto';
import { StartTestResponseDto } from './dto/start-assessment.dto';
import { TestResultDto } from './dto/assessment-result.dto';
import { FeedBackDto } from './dto/submit-feedback.dto';
import { GetResultDto } from './dto/get-results.dto';
import { AdminSendResultsDto } from './dto/admin-send-results.dto';

/**
 * 🎯 CAREER ASSESSMENTS
 *
 * This controller manages the RIASEC career assessment system.
 *
 * **ASSESSMENT FLOW:**
 * 1. Start Test → Get 60 randomized questions
 * 2. Submit Test → Receive session token & result ID
 * 3. Get Result → View results using access token + student info
 *
 * **USER ROLES & PERMISSIONS:**
 *
 * 🟠 PUBLIC (No Authentication)
 *    - Start new test session
 *    - Submit test responses
 *    - View results with access token (token-based, no auth required)
 *    - Submit feedback
 *
 * 🔵 ADMIN (Organization Management)
 *    - All public operations
 *    - View token usage reports
 *    - Manually send results to any email
 *    - Track usage by class/grade
 *
 * 🔴 SUPER_ADMIN (Full Platform Access)
 *    - All admin operations
 *    - Platform-wide analytics
 *
 * **ACCESS TOKEN SYSTEM:**
 * - First view: Token usage count increments (unlocks result)
 * - Subsequent views: Same student unlimited reviews (no additional charge)
 * - Tracks which students accessed which results
 *
 * **ASSESSMENT DETAILS:**
 * - 60 randomized questions from RIASEC categories
 * - AI-powered stream recommendations
 * - Career matching algorithm
 * - Comprehensive PDF reports
 */
@ApiTags('Assessments')
@ApiBearerAuth('bearer')
@Controller('v2/assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🟠 Start a new RIASEC test session',
    description: `
**Roles:** PUBLIC (No authentication required)

Start a new career assessment session.

**Returns:**
- Session token (valid for 24 hours)
- 60 randomized questions from RIASEC categories
- Question IDs for submission

**Categories:** Realistic, Investigative, Artistic, Social, Enterprising, Conventional
    `,
  })
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
  @ApiOperation({
    summary: '🟠 Submit test responses',
    description: `
**Roles:** PUBLIC (No authentication required)

Submit completed test responses and generate results.

**Process:**
1. Validates all 60 responses
2. Calculates RIASEC scores
3. Matches careers using algorithm
4. Generates AI stream recommendation
5. Stores result with session token

**Important:** To view results, you need an access token. Use the \`GET /result\` endpoint.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Test submitted successfully. Use access token to view results.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        sessionToken: { type: 'string', example: 'a3f8d9e2b1c4567890abcdef' },
        resultId: { type: 'string', example: 'clx123456789' },
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
    const result = await this.assessmentsService.submitTest(dto);

    return {
      success: true,
      sessionToken: dto.sessionToken,
      resultId: result.resultId,
      message: 'Test submitted successfully. Please provide an access token to view results.',
    };
  }

  @Get('result')
  @ApiOperation({
    summary: '🟠 Get test result with access token',
    description: `
**Roles:** PUBLIC (No authentication required - uses access token)

View test results using an access token and student information.

**Access Control:**
- **First Access:** Token usage count increments (unlocks the result)
- **Subsequent Views:** Same student can review unlimited times (no additional charge)

**Returns:**
- RIASEC scores breakdown
- Top 10 career matches with compatibility scores
- AI-generated stream recommendation (Science/Commercial/Art)
- Personalized career guidance

**Email Results:**
- If parent email provided on first access, results are automatically emailed
- Includes comprehensive PDF report
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
  @ApiQuery({
    name: 'parentEmail',
    description: 'Parent email (optional - for auto-sending results)',
    required: false,
  })
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

  @Get('token-report/:token')
  @ApiOperation({
    summary: '🔵 Get token usage report',
    description: `
**Roles:** ADMIN

Shows all students who have used this token to unlock results.

**Perfect for:**
- School administrators tracking student participation
- Organization managers monitoring token usage
- Verifying assessment completion

**Returns:**
- Token details (type, status, expiry)
- Usage statistics (total unlocks, remaining uses)
- Complete student list with view counts
- Timestamps for first and last access
    `,
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

  @Get('token-report/:token/by-class')
  @ApiOperation({
    summary: '🔵 Get token usage by class',
    description: `
**Roles:** ADMIN

Shows usage statistics grouped by student class/grade.

**Use cases:**
- Compare participation across different classes
- Identify which grades have completed assessments
- Track engagement by class level

**Returns:**
- Breakdown by class/grade
- Students unlocked per class
- Total views per class
    `,
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
  @ApiOperation({
    summary: '🟠 Submit feedback on results',
    description: `
**Roles:** PUBLIC (No authentication required)

Provide feedback and rating for assessment results.

**Helps us improve:**
- Assessment accuracy
- Career recommendations
- User experience
- Result clarity

**Rating:** 1-5 stars
**Feedback:** Optional text feedback
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Feedback submitted successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Result not found' })
  async submitFeedback(@Body() dto: FeedBackDto) {
    return this.assessmentsService.submitFeedback(dto);
  }

  @Post('admin/send-results')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔴 Manually send results email',
    description: `
**Roles:** SUPER_ADMIN, ADMIN

Admin endpoint to retrieve test results by session token and send them to any specified email address.

**Use cases:**
- Resend results to parent/guardian
- Send results to school counselor
- Share results with additional stakeholders
- Customer support scenarios

**No token validation required** - pure admin override for customer service.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Results email sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Results email sent successfully' },
        resultId: { type: 'string' },
        sentTo: { type: 'string', example: 'parent@example.com' },
        studentName: { type: 'string', example: 'John Doe' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Test result not found' })
  @ApiResponse({ status: 500, description: 'Failed to send email' })
  async adminSendResults(@Body() dto: AdminSendResultsDto) {
    return this.assessmentsService.adminSendResultsBySession(dto);
  }
}
