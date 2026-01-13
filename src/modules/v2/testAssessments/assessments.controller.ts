// assessments.controller.ts

import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiResponse as NestApiResponse,
} from '@nestjs/swagger';
import { ApiResponse } from 'src/common/dto/response.dto';
// import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { RequestId } from 'src/common/decorators/request-metadata.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { SubmitTestDto } from './dto/submit-assessment.dto';
import { AssessmentsService } from './assessments.service';
import { GetResultDto } from './dto/get-results.dto';
import { FeedBackDto } from './dto/submit-feedback.dto';
import { SuperAdminOnly } from 'src/common/decorators/roles.decorator';
import { AdminSendResultsDto } from './dto/admin-send-results.dto';
import { PaginationQueryDto } from './dto/pagination-querry.dto';
import { Request } from 'express';

@ApiTags('Assessments')
@Public()
@ApiBearerAuth('bearer')
@Controller('v2/assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '🟠 Start a new RIASEC test session' })
  @NestApiResponse({ status: 200, description: 'Test session created successfully' })
  async startTest(@RequestId() requestId: string) {
    const data = await this.assessmentsService.startTest();
    return ApiResponse.success(data, 'Test session created successfully', requestId);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '🟠 Submit test responses' })
  @NestApiResponse({ status: 200, description: 'Test submitted successfully' })
  async submitTest(@Body() dto: SubmitTestDto, @RequestId() requestId: string) {
    const result = await this.assessmentsService.submitTest(dto);

    const responseData = {
      sessionToken: dto.sessionToken,
      resultId: result.resultId,
      message: 'Test submitted successfully. Use access token to view results.',
    };

    return ApiResponse.success(responseData, 'Test submitted successfully', requestId);
  }

  @Get('result')
  @ApiOperation({ summary: '🟠 Get test result with access token' })
  @NestApiResponse({ status: 200, description: 'Test result retrieved successfully' })
  async getResult(@Query() dto: GetResultDto, @RequestId() requestId: string) {
    const data = await this.assessmentsService.getResultWithToken(dto);
    return ApiResponse.success(data, 'Test result retrieved successfully', requestId);
  }

  @Get('token-report/:token')
  @ApiOperation({ summary: '🔵 Get token usage report' })
  @NestApiResponse({ status: 200, description: 'Token usage report retrieved' })
  async getTokenReport(@Param('token') token: string, @RequestId() requestId: string) {
    const data = await this.assessmentsService.getTokenUsageReport(token);
    return ApiResponse.success(data, 'Token usage report retrieved', requestId);
  }

  @Get('token-report/:token/by-class')
  @ApiOperation({ summary: '🔵 Get token usage by class' })
  @NestApiResponse({ status: 200, description: 'Usage by class retrieved' })
  async getUsageByClass(@Param('token') token: string, @RequestId() requestId: string) {
    const data = await this.assessmentsService.getUsageByClass(token);
    return ApiResponse.success(data, 'Usage by class retrieved', requestId);
  }

  @Get('token-report/:token/detailed')
  @ApiOperation({
    summary: '🔵 Get comprehensive token usage report with pagination',
    description: `Enhanced paginated report with full student results and analytics.`,
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @NestApiResponse({ status: 200, description: 'Detailed report retrieved with pagination' })
  async getTokenReportDetailed(
    @Param('token') token: string,
    @Query() paginationDto: PaginationQueryDto,
    @RequestId() requestId: string,
    @Req() req: Request,
  ) {
    // Build base URL for pagination links
    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}/token-report/${token}/detailed`;

    const result = await this.assessmentsService.getTokenUsageReportDetailed(
      token,
      paginationDto.page,
      paginationDto.limit,
      baseUrl,
    );

    // ✅ Use ApiResponse.successWithPagination
    return ApiResponse.successWithPagination(
      {
        tokenInfo: result.tokenInfo,
        usageStats: result.usageStats,
        analytics: result.analytics,
        students: result.students,
      },
      result.pagination,
      result.links,
      'Detailed token report retrieved successfully',
      requestId,
    );
  }

  @Post('feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '🟠 Submit feedback on results' })
  @NestApiResponse({ status: 200, description: 'Feedback submitted successfully' })
  async submitFeedback(@Body() dto: FeedBackDto, @RequestId() requestId: string) {
    const data = await this.assessmentsService.submitFeedback(dto);
    return ApiResponse.success(data, 'Feedback submitted successfully', requestId);
  }

  @Post('superAdmin/send-results')
  @SuperAdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '🔴 Manually send results email' })
  @NestApiResponse({ status: 200, description: 'Results email sent successfully' })
  async adminSendResults(@Body() dto: AdminSendResultsDto, @RequestId() requestId: string) {
    const data = await this.assessmentsService.adminSendResultsBySession(dto);
    return ApiResponse.success(data, 'Results email sent successfully', requestId);
  }
}
