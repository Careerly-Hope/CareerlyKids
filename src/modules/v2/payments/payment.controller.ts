// src/modules/v2/payments/payment.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payment.service';
import { AllAuthenticated, Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { CurrentUser, CurrentUserId } from '../../../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/roles.guard';

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

  @Get('admin/statistics')
 @AllAuthenticated()
  @ApiOperation({ summary: 'Get payment statistics' })
  async getPaymentStatistics() {
    return this.paymentsService.getPaymentStatistics();
  }
}