// src/modules/v2/payments/payment.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payment.service';
import { AllAuthenticated, SuperAdminOnly } from '../../../common/decorators/roles.decorator';
import { CurrentUserId } from '../../../common/decorators/current-user.decorator';

@ApiTags('Payments')
@ApiBearerAuth('bearer')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    // REMOVED: TokenPurchaseOrchestrator - not needed here
  ) {}

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
    return this.paymentsService.getUserPaymentHistory(userId, { page, limit });
  }

  // ===================================================================
  // ADMIN ENDPOINTS
  // ===================================================================

  @Get('superAdmin/statistics')
  @SuperAdminOnly() 
  @ApiOperation({ summary: 'Get payment statistics' })
  async getPaymentStatistics() {
    return this.paymentsService.getPaymentStatistics();
  }
}
