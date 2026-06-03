// src/modules/v2/payments/payment.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payment.service';
import { AllAuthenticated, SuperAdminOnly } from '../../../common/decorators/roles.decorator';
import { CurrentUserId } from '../../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../../common/dto/response.dto';

@ApiTags('Payments')
@ApiBearerAuth('bearer')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ===================================================================
  // USER PAYMENT HISTORY
  // ===================================================================
  @Get('my-history')
  @AllAuthenticated()
  @ApiOperation({ summary: 'Get user payment history' })
  async getMyPaymentHistory(
    @CurrentUserId() userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.paymentsService.getUserPaymentHistory(userId, { page, limit });
    return ApiResponse.success(result, 'Payment history retrieved successfully');
  }

  // ===================================================================
  // ADMIN ENDPOINTS
  // ===================================================================
  @Get('superAdmin/statistics')
  @SuperAdminOnly()
  @ApiOperation({ summary: 'Get payment statistics' })
  async getPaymentStatistics() {
    const statistics = await this.paymentsService.getPaymentStatistics();
    return ApiResponse.success(statistics, 'Payment statistics retrieved successfully');
  }
}