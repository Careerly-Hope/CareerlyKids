// ================================================================
// src/modules/v2/payments/payments.service.ts
// REFACTORED: Pure Paystack operations only
// ================================================================
import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paystackSecretKey: string;
  private readonly paystackPublicKey: string;
  private readonly paystackWebhookSecret: string;
  private readonly paystackBaseUrl = 'https://api.paystack.co';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.paystackSecretKey = this.config.get('PAYSTACK_SECRET_KEY');
    this.paystackPublicKey = this.config.get('PAYSTACK_PUBLIC_KEY');
    this.paystackWebhookSecret = this.config.get('PAYSTACK_WEBHOOK_SECRET');

    if (!this.paystackSecretKey || !this.paystackWebhookSecret) {
      throw new Error('Paystack credentials not configured');
    }
  }

  // ===================================================================
  // CORE PAYSTACK OPERATIONS
  // ===================================================================

  /**
   * Create payment record and initialize with Paystack
   */
  async initializePaystackTransaction(params: {
    userId?: string;
    email: string;
    amount: number; // In Naira
    metadata: {
      tokenType: 'INDIVIDUAL' | 'BULK';
      quantity: number;
      email: string;
      name: string;
      school?: string;
      isGuest?: boolean;
    };
    callbackUrl?: string;
  }) {
    this.logger.log(`Initializing Paystack transaction for ${params.email}${params.metadata.isGuest ? ' (GUEST)' : ''}`);

    const reference = this.generateReference();
    const amountInKobo = params.amount * 100;

    // 1. Create payment record (PENDING)
    const payment = await this.prisma.payment.create({
      data: {
        reference,
        userId: params.userId||null,
        guestEmail: params.metadata.isGuest ? params.email : null, // ✅ Store guest email

        amount: amountInKobo,
        currency: 'NGN',
        status: PaymentStatus.PENDING,
        metadata: params.metadata,
      },
    });

    // 2. Call Paystack API
    try {
      const response = await fetch(`${this.paystackBaseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: params.email,
          amount: amountInKobo,
          reference,
          metadata: params.metadata,
          callback_url: params.callbackUrl || `${this.config.get('FRONTEND_URL')}/payment/verify`,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.status) {
        this.logger.error('Paystack initialization failed:', data);
        
        // Mark payment as failed
        await this.updatePaymentStatus(payment.id, PaymentStatus.FAILED, {
          failedAt: new Date(),
          failureReason: data.message || 'Payment initialization failed',
        });

        throw new BadRequestException(data.message || 'Payment initialization failed');
      }

      // 3. Update payment with Paystack data
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          paystackReference: data.data.reference,
          authorizationUrl: data.data.authorization_url,
          accessCode: data.data.access_code,
        },
      });

      return {
        paymentId: payment.id,
        reference: payment.reference,
        authorizationUrl: data.data.authorization_url,
        accessCode: data.data.access_code,
      };
    } catch (error) {
      this.logger.error('Paystack API error:', error);

      // Mark payment as failed
      await this.updatePaymentStatus(payment.id, PaymentStatus.FAILED, {
        failedAt: new Date(),
        failureReason: error.message,
      });

      throw new InternalServerErrorException('Failed to initialize payment with Paystack');
    }
  }

  /**
   * Verify payment with Paystack API
   */
  async verifyPaystackTransaction(reference: string) {
    this.logger.log(`Verifying Paystack transaction: ${reference}`);

    try {
      const response = await fetch(
        `${this.paystackBaseUrl}/transaction/verify/${reference}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok || !data.status) {
        throw new BadRequestException('Verification failed with Paystack');
      }

      return {
        success: data.data.status === 'success',
        status: data.data.status,
        amount: data.data.amount,
        paidAt: data.data.paid_at,
        gatewayResponse: data.data.gateway_response,
        metadata: data.data.metadata,
      };
    } catch (error) {
      this.logger.error('Paystack verification error:', error);
      throw new InternalServerErrorException('Failed to verify payment with Paystack');
    }
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha512', this.paystackWebhookSecret)
      .update(payload)
      .digest('hex');
    return hash === signature;
  }

  // ===================================================================
  // DATABASE OPERATIONS (Simple CRUD)
  // ===================================================================

  /**
   * Get payment by reference
   */
  async getPaymentByReference(reference: string) {
    return this.prisma.payment.findUnique({
      where: { reference },
    });
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string) {
    return this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    additionalData: {
      paidAt?: Date;
      failedAt?: Date;
      refundedAt?: Date;
      failureReason?: string;
      paystackReference?: string;
    } = {},
  ) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status,
        ...additionalData,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Link payment to token
   */
  async linkPaymentToToken(paymentId: string, tokenId: string) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { tokenId },
    });
  }

  /**
   * Get user payment history
   */
  async getUserPaymentHistory(
    userId: string,
    query: { page?: number; limit?: number; status?: PaymentStatus },
  ) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (status) where.status = status;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reference: true,
          amount: true,
          currency: true,
          status: true,
          metadata: true,
          tokenId: true,
          paidAt: true,
          createdAt: true,
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      payments: payments.map((p) => ({
        ...p,
        amount: p.amount / 100, // Convert kobo to Naira
        tokenGenerated: !!p.tokenId,
      })),
    };
  }

  /**
   * Get payment statistics (Admin)
   */
  async getPaymentStatistics() {
    const [totalPayments, completedPayments, failedPayments, pendingPayments, revenueData] =
      await Promise.all([
        this.prisma.payment.count(),
        this.prisma.payment.count({ where: { status: PaymentStatus.COMPLETED } }),
        this.prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
        this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
        this.prisma.payment.aggregate({
          where: { status: PaymentStatus.COMPLETED },
          _sum: { amount: true },
        }),
      ]);

    return {
      totalPayments,
      completedPayments,
      failedPayments,
      pendingPayments,
      totalRevenue: (revenueData._sum.amount || 0) / 100,
      successRate:
        totalPayments > 0 ? ((completedPayments / totalPayments) * 100).toFixed(2) + '%' : '0%',
    };
  }

  // ===================================================================
  // HELPERS
  // ===================================================================

  private generateReference(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `PAY-${timestamp}-${random}`.toUpperCase();
  }
}