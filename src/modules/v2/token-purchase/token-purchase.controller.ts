// src/modules/v2/token-purchase/token-purchase.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Req,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TokenPurchaseOrchestrator } from './token-purchase.orchestrator';
import { PaymentsService } from '../payments/payment.service';
import { CurrentUserId } from '../../../common/decorators/current-user.decorator';
import {
  AdminOnly,
  AllAuthenticated,
  SuperAdminOnly,
} from '../../../common/decorators/roles.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PurchaseBulkTokenDto } from './dto/purchase-bulk.dto';
import { BulkQuoteDto } from './dto/bulk-quote.dto';
import { PurchaseIndividualTokenDto } from './dto/purchase-indivdual.dto';
import { PaystackWebhookDto } from './dto/paystack-webhook.dto';
import { ApiResponse } from '../../../common/dto/response.dto';

@ApiTags('Token Purchase')
@Controller('token-purchase')
export class TokenPurchaseController {
  constructor(
    private readonly orchestrator: TokenPurchaseOrchestrator,
    private readonly paymentsService: PaymentsService,
  ) {}

  // ===================================================================
  // INDIVIDUAL TOKEN PURCHASE
  // ===================================================================
  @Post('individual')
  @AllAuthenticated()
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🟢 Purchase individual token',
    description: 'Initialize payment for a single-use token (₦5,000)',
  })
  async purchaseIndividualToken(
    @Body() dto: PurchaseIndividualTokenDto,
    @CurrentUserId() userId: string,
  ) {
    const result = await this.orchestrator.purchaseIndividualToken(dto, userId);
    return ApiResponse.success(
      result,
      'Individual token purchase initialized successfully',
    );
  }

  // ===================================================================
  // BULK TOKEN PURCHASE
  // ===================================================================
  @Post('bulk/quote')
  @AdminOnly()
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔵 Get bulk purchase quote',
    description: 'Calculate pricing for bulk tokens with volume discounts',
  })
  async getBulkQuote(@Body() dto: BulkQuoteDto) {
    const quote = await this.orchestrator.getBulkQuote(dto.quantity);
    return ApiResponse.success(quote, 'Bulk purchase quote generated successfully');
  }

  @Post('bulk')
  @UseGuards(RolesGuard)
  @AdminOnly()
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔵 Purchase bulk token',
    description: 'Initialize payment for enterprise token with multiple uses',
  })
  async purchaseBulkToken(
    @Body() dto: PurchaseBulkTokenDto,
    @CurrentUserId() userId: string,
  ) {
    const result = await this.orchestrator.purchaseBulkToken(dto, userId);
    return ApiResponse.success(result, 'Bulk token purchase initialized successfully');
  }

  // ===================================================================
  // PAYMENT VERIFICATION
  // ===================================================================
  @Get('verify/:reference')
  @Public()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '✅ Verify payment and generate token',
    description: 'Verify payment status with Paystack and generate token if successful',
  })
  async verifyPayment(@Param('reference') reference: string) {
    const result = await this.orchestrator.verifyPaymentAndGenerateToken(reference);
    return ApiResponse.success(result, 'Payment verified and token generated successfully');
  }

  // ===================================================================
  // WEBHOOK ENDPOINT (PUBLIC)
  // ===================================================================
  @Post('webhook/paystack')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔓 Handle Paystack webhooks',
    description: 'Receives payment notifications from Paystack and triggers token generation',
  })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
  ) {
    // Validate signature
    const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);
    if (!this.paymentsService.validateWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Parse payload
    const payload = req.body as unknown as PaystackWebhookDto;

    // Process event via orchestrator
    await this.orchestrator.processWebhookEvent(payload.event, payload.data);

    return ApiResponse.success(null, 'Webhook processed successfully');
  }

  // ===================================================================
  // ADMIN: RETRY TOKEN GENERATION
  // ===================================================================
  @Post('superAdmin/retry/:paymentId')
  @SuperAdminOnly()
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔴 Retry token generation',
    description: 'Manually retry token generation for completed payment (Admin only)',
  })
  async retryTokenGeneration(@Param('paymentId') paymentId: string) {
    const result = await this.orchestrator.retryTokenGeneration(paymentId);
    return ApiResponse.success(result, 'Token generation retry completed successfully');
  }
} 