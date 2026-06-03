// ================================================================
// src/modules/v2/token-purchase/token-purchase.orchestrator.ts
// ORCHESTRATOR: Owns entire purchase-to-token flow
// ================================================================
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentsService } from '../payments/payment.service';
import { TokensService } from '../tokens/access-token.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class TokenPurchaseOrchestrator {
  private readonly logger = new Logger(TokenPurchaseOrchestrator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly tokensService: TokensService,
  ) {}

  // ===================================================================
  // INDIVIDUAL TOKEN PURCHASE FLOW
  // ===================================================================

  /**
   * Purchase individual token
   * Flow: Calculate price → Initialize payment → Return payment URL
   */
  async purchaseIndividualToken(
    data: {
      email: string;
      name: string;
    },
    userId?: string,
  ) {
    const isGuest = !userId;

    this.logger.log(
      isGuest
        ? `Guest purchasing individual token: ${data.email}`
        : `User ${userId} purchasing individual token`,
    );

    const INDIVIDUAL_TOKEN_PRICE = 5000; // ₦5,000

    // Initialize payment with Paystack
    const payment = await this.paymentsService.initializePaystackTransaction({
      userId,
      email: data.email,
      amount: INDIVIDUAL_TOKEN_PRICE,
      metadata: {
        tokenType: 'INDIVIDUAL',
        quantity: 1,
        email: data.email,
        name: data.name,
        isGuest,
      },
    });

    return {
      success: true,
      message: 'Payment initialized. Complete payment to receive your token.',
      paymentId: payment.paymentId,
      reference: payment.reference,
      authorizationUrl: payment.authorizationUrl,
      amount: INDIVIDUAL_TOKEN_PRICE,
      currency: 'NGN',
      isGuest,
    };
  }

  // ===================================================================
  // BULK TOKEN PURCHASE FLOW
  // ===================================================================

  /**
   * Get bulk purchase quote (no database write)
   */
  async getBulkQuote(quantity: number) {
    return this.tokensService.calculateBulkQuote(quantity);
  }

  /**
   * Purchase bulk token
   * Flow: Calculate quote → Initialize payment → Return payment URL
   */
  async purchaseBulkToken(
    data: {
      email: string;
      name: string;
      school: string;
      quantity: number;
    },
    userId: string,
  ) {
    this.logger.log(`User ${userId} purchasing bulk token: ${data.quantity} uses`);

    // Calculate pricing
    const quote = this.tokensService.calculateBulkQuote(data.quantity);

    // Initialize payment with Paystack
    const payment = await this.paymentsService.initializePaystackTransaction({
      userId,
      email: data.email,
      amount: quote.totalPrice,
      metadata: {
        tokenType: 'BULK',
        quantity: data.quantity,
        email: data.email,
        name: data.name,
        school: data.school,
      },
    });

    return {
      success: true,
      message: 'Payment initialized. Complete payment to receive your bulk token.',
      paymentId: payment.paymentId,
      reference: payment.reference,
      authorizationUrl: payment.authorizationUrl,
      amount: quote.totalPrice,
      currency: 'NGN',
      quote: {
        quantity: quote.quantity,
        pricePerToken: quote.pricePerToken,
        totalPrice: quote.totalPrice,
        discount: quote.discount,
        savings: quote.savings,
      },
    };
  }

  // ===================================================================
  // PAYMENT VERIFICATION & TOKEN GENERATION
  // ===================================================================

  /**
   * Verify payment and generate token (called by user or webhook)
   *
   * This is the critical flow:
   * 1. Verify payment with Paystack
   * 2. Update payment status in DB
   * 3. Generate token
   * 4. Link payment to token
   *
   * ALL in a transaction for safety!
   */
  async verifyPaymentAndGenerateToken(reference: string) {
    this.logger.log(`🔍 Verifying payment: ${reference}`);

    // 1. Get payment from DB
    const payment = await this.paymentsService.getPaymentByReference(reference);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const metadata = payment.metadata as any;
    const isGuest = metadata.isGuest || !payment.userId;

    // 2. If already completed with token, return existing token
    if (payment.status === PaymentStatus.COMPLETED && payment.tokenId) {
      this.logger.log(`✅ Payment already processed with token: ${reference}`);

      const token = await this.tokensService.getTokenByCode(payment.tokenId);

      return {
        status: 'success',
        reference: payment.reference,
        amount: payment.amount / 100,
        paidAt: payment.paidAt,
        tokenGenerated: true,
        tokenCode: token.token,
        message: 'Payment already verified and token generated',
        isGuest,
      };
    }

    // 3. Verify with Paystack API
    const verification = await this.paymentsService.verifyPaystackTransaction(reference);

    if (!verification.success) {
      // Payment failed
      await this.paymentsService.updatePaymentStatus(payment.id, PaymentStatus.FAILED, {
        failedAt: new Date(),
        failureReason: verification.gatewayResponse,
      });

      return {
        status: 'failed',
        reference: payment.reference,
        message: verification.gatewayResponse,
      };
    }

    // 4. Payment successful - Generate token in transaction
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Update payment status
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            paidAt: new Date(verification.paidAt),
            paystackReference: reference,
          },
        });

        // Generate token based on type
        const metadata = payment.metadata as any;
        let token;

        if (metadata.tokenType === 'INDIVIDUAL') {
          token = await this.tokensService.createIndividualToken({
            email: metadata.email,
            name: metadata.name,
            userId: payment.userId || undefined,
            paymentId: payment.id,
            amountPaid: payment.amount,
            isGuest,
          });
        } else if (metadata.tokenType === 'BULK') {
          token = await this.tokensService.createBulkToken({
            email: metadata.email,
            name: metadata.name,
            school: metadata.school,
            quantity: metadata.quantity,
            userId: payment.userId,
            paymentId: payment.id,
            amountPaid: payment.amount,
          });
        } else {
          throw new BadRequestException('Invalid token type');
        }

        // Link payment to token
        await tx.payment.update({
          where: { id: payment.id },
          data: { tokenId: token.id },
        });

        return { payment: updatedPayment, token };
      });

      this.logger.log(`✅ Payment verified and token generated: ${result.token.token}`);

      return {
        status: 'success',
        reference: payment.reference,
        amount: payment.amount / 100,
        paidAt: result.payment.paidAt,
        tokenGenerated: true,
        tokenCode: result.token.token,
        message: 'Payment successful! Token generated and sent to your email.',
        isGuest,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to generate token for payment ${reference}:`, error.stack);

      // Mark payment as completed but flag token generation failure
      await this.paymentsService.updatePaymentStatus(payment.id, PaymentStatus.COMPLETED, {
        paidAt: new Date(verification.paidAt),
        paystackReference: reference,
      });

      // TODO: Emit event for admin notification
      // this.eventEmitter.emit('token.generation.failed', { payment, error });

      throw new InternalServerErrorException(
        'Payment successful but token generation failed. Please contact support.',
      );
    }
  }

  // ===================================================================
  // WEBHOOK HANDLER
  // ===================================================================

  /**
   * Process webhook event (called by PaymentsController)
   *
   * Handles 'charge.success' events from Paystack
   */
  async processWebhookEvent(event: string, data: any) {
    this.logger.log(`📨 Processing webhook: ${event} for ${data.reference}`);

    if (event === 'charge.success') {
      // Verify and generate token (idempotent)
      try {
        await this.verifyPaymentAndGenerateToken(data.reference);
        this.logger.log(`✅ Webhook processed successfully: ${data.reference}`);
      } catch (error) {
        // Log error but don't throw - webhook should return 200
        this.logger.error(`❌ Webhook processing failed: ${data.reference}`, error.stack);
      }
    } else {
      this.logger.log(`⏭️ Ignoring webhook event: ${event}`);
    }
  }

  // ===================================================================
  // RETRY FAILED TOKEN GENERATION (Admin)
  // ===================================================================

  /**
   * Retry token generation for completed payment (Admin operation)
   */
  async retryTokenGeneration(paymentId: string) {
    this.logger.log(`🔄 Retrying token generation for payment: ${paymentId}`);

    const payment = await this.paymentsService.getPaymentById(paymentId);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Payment not completed');
    }

    if (payment.tokenId) {
      const token = await this.tokensService.getTokenByCode(payment.tokenId);
      return {
        success: true,
        message: 'Token already exists',
        tokenCode: token.token,
      };
    }

    // Generate token
    const metadata = payment.metadata as any;
    let token;

    if (metadata.tokenType === 'INDIVIDUAL') {
      token = await this.tokensService.createIndividualToken({
        email: metadata.email,
        name: metadata.name,
        userId: payment.userId,
        paymentId: payment.id,
        amountPaid: payment.amount,
      });
    } else if (metadata.tokenType === 'BULK') {
      token = await this.tokensService.createBulkToken({
        email: metadata.email,
        name: metadata.name,
        school: metadata.school,
        quantity: metadata.quantity,
        userId: payment.userId,
        paymentId: payment.id,
        amountPaid: payment.amount,
      });
    } else {
      throw new BadRequestException('Invalid token type');
    }

    // Link payment to token
    await this.paymentsService.linkPaymentToToken(payment.id, token.id);

    this.logger.log(`✅ Token generation retry successful: ${token.token}`);

    return {
      success: true,
      message: 'Token generated successfully',
      tokenCode: token.token,
    };
  }
}
