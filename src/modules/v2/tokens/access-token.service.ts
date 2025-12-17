// ================================================================
// src/modules/v2/tokens/tokens.service.ts
// REFACTORED: Pure token CRUD operations only
// ================================================================
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/services/email/email.service';
import { TokenType, TokenStatus, PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // ===================================================================
  // TOKEN CREATION
  // ===================================================================

  /**
   * Create individual token (called by orchestrator after successful payment)
   */
  async createIndividualToken(data: {
    email: string;
    name: string;
    userId: string;
    paymentId: string;
    amountPaid: number;
    isGuest?: boolean;
  }) {
    const tokenCode = this.generateTokenCode('INDIV');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const token = await this.prisma.accessToken.create({
      data: {
        token: tokenCode,
        email: data.email,
        name: data.name,
        type: TokenType.INDIVIDUAL,
        status: TokenStatus.ACTIVE,
        maxUsage: 1,
        usageCount: 0,
        expiresAt,
        ownerId: data.userId || null,
        amountPaid: data.amountPaid,
        paymentIntentId: data.paymentId,
        paymentStatus: PaymentStatus.COMPLETED,
        currency: 'NGN',
        createdBy: data.isGuest ? 'GUEST_PURCHASE' : 'USER_PURCHASE',
      },
    });

    // Send email notification
    await this.emailService.sendAccessToken({
      email: data.email,
      name: data.name,
      token: tokenCode,
      type: TokenType.INDIVIDUAL,
      expiresAt,
      maxUsage: 1,
    });

    this.logger.log(`✅ Individual token created: ${tokenCode}`);

    return token;
  }

  /**
   * Create bulk/enterprise token (called by orchestrator after successful payment)
   */
  async createBulkToken(data: {
    email: string;
    name: string;
    school: string;
    quantity: number;
    userId: string;
    paymentId: string;
    amountPaid: number;
  }) {
    const tokenCode = this.generateTokenCode(data.school);
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    const token = await this.prisma.accessToken.create({
      data: {
        token: tokenCode,
        email: data.email,
        name: data.name,
        school: data.school,
        type: TokenType.ENTERPRISE,
        status: TokenStatus.ACTIVE,
        maxUsage: data.quantity,
        usageCount: 0,
        expiresAt,
        ownerId: data.userId,
        amountPaid: data.amountPaid,
        paymentIntentId: data.paymentId,
        paymentStatus: PaymentStatus.COMPLETED,
        currency: 'NGN',
        createdBy: 'ADMIN_BULK',
      },
    });

    // Send email notification
    await this.emailService.sendAccessToken({
      email: data.email,
      name: data.name,
      school: data.school,
      token: tokenCode,
      type: TokenType.ENTERPRISE,
      expiresAt,
      maxUsage: data.quantity,
    });

    this.logger.log(`✅ Bulk token created: ${tokenCode} (${data.quantity} uses)`);

    return token;
  }

  // ===================================================================
  // TOKEN QUERIES
  // ===================================================================

  /**
   * Get token by code
   */
  async getTokenByCode(code: string) {
    const token = await this.prisma.accessToken.findUnique({
      where: { token: code },
    });

    if (!token) {
      throw new NotFoundException('Token not found');
    }

    return token;
  }

  /**
   * Get user's tokens
   */
  async getUserTokens(userId: string) {
    const tokens = await this.prisma.accessToken.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        token: true,
        type: true,
        status: true,
        usageCount: true,
        maxUsage: true,
        expiresAt: true,
        createdAt: true,
        amountPaid: true,
        school: true,
      },
    });

    return {
      total: tokens.length,
      tokens: tokens.map((t) => ({
        ...t,
        amountPaid: t.amountPaid ? t.amountPaid / 100 : 0,
        remainingUsage: t.maxUsage - t.usageCount,
        isExpired: new Date() > t.expiresAt,
      })),
    };
  }

  /**
   * Get token details with usage history (owner only)
   */
  async getTokenDetails(code: string, userId: string) {
    const token = await this.prisma.accessToken.findUnique({
      where: { token: code },
      include: {
        usageRecords: {
          orderBy: { unlockedAt: 'desc' },
        },
      },
    });

    if (!token) {
      throw new NotFoundException('Token not found');
    }

    if (token.ownerId !== userId) {
      throw new ForbiddenException('You do not own this token');
    }

    return {
      id: token.id,
      code: token.token,
      type: token.type,
      status: token.status,
      email: token.email,
      name: token.name,
      school: token.school,
      usageCount: token.usageCount,
      maxUsage: token.maxUsage,
      remainingUsage: token.maxUsage - token.usageCount,
      amountPaid: token.amountPaid ? token.amountPaid / 100 : 0,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      usageHistory: token.usageRecords,
    };
  }

  /**
   * Validate token status (public endpoint)
   */
  async validateToken(code: string) {
    const token = await this.prisma.accessToken.findUnique({
      where: { token: code },
    });

    if (!token) {
      return { valid: false, reason: 'Token not found' };
    }

    if (new Date() > token.expiresAt) {
      return { valid: false, reason: 'Token expired' };
    }

    if (token.status !== TokenStatus.ACTIVE) {
      return { valid: false, reason: `Token is ${token.status.toLowerCase()}` };
    }

    if (token.usageCount >= token.maxUsage) {
      return { valid: false, reason: 'Usage limit exceeded' };
    }

    return {
      valid: true,
      type: token.type,
      remainingUsage: token.maxUsage - token.usageCount,
      expiresAt: token.expiresAt,
    };
  }

  /**
   * Get valid token (throws if invalid)
   */
  async getValidToken(code: string) {
    const token = await this.getTokenByCode(code);

    if (new Date() > token.expiresAt) {
      throw new BadRequestException('Token expired');
    }

    if (token.status !== TokenStatus.ACTIVE) {
      throw new BadRequestException(`Token is ${token.status.toLowerCase()}`);
    }

    if (token.usageCount >= token.maxUsage) {
      throw new BadRequestException('Usage limit exceeded');
    }

    return token;
  }

  // ===================================================================
  // TOKEN USAGE
  // ===================================================================

  /**
   * Mark token as used (called when unlocking assessment)
   */
  async markTokenUsed(tokenCode: string): Promise<void> {
    const token = await this.getTokenByCode(tokenCode);

    await this.prisma.accessToken.update({
      where: { token: tokenCode },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
        ...(token.firstUsedAt === null && { firstUsedAt: new Date() }),
      },
    });

    this.logger.log(`✅ Token ${tokenCode} usage: ${token.usageCount + 1}/${token.maxUsage}`);
  }

  // ===================================================================
  // ADMIN OPERATIONS
  // ===================================================================

  /**
   * Calculate bulk pricing quote
   */
  calculateBulkQuote(quantity: number) {
    let pricePerToken = 5000; // Base price
    let discount = 0;

    if (quantity >= 100) {
      pricePerToken = 3500; // 30% off
      discount = 30;
    } else if (quantity >= 50) {
      pricePerToken = 4000; // 20% off
      discount = 20;
    } else if (quantity >= 20) {
      pricePerToken = 4500; // 10% off
      discount = 10;
    }

    return {
      quantity,
      pricePerToken,
      totalPrice: quantity * pricePerToken,
      discount,
      currency: 'NGN',
      savings: quantity * (5000 - pricePerToken),
    };
  }

  /**
   * Get all tokens (Super Admin)
   */
  async getAllTokens(query: {
    type?: TokenType;
    status?: TokenStatus;
    page?: number;
    limit?: number;
  }) {
    const { type, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [tokens, total] = await Promise.all([
      this.prisma.accessToken.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: { email: true, firstName: true, lastName: true },
          },
          _count: {
            select: { usageRecords: true },
          },
        },
      }),
      this.prisma.accessToken.count({ where }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      tokens: tokens.map((t) => ({
        tokenCode: t.token,
        type: t.type,
        status: t.status,
        school: t.school,
        owner: t.owner,
        usageCount: t.usageCount,
        maxUsage: t.maxUsage,
        totalStudents: t._count.usageRecords,
        expiresAt: t.expiresAt,
        createdAt: t.createdAt,
      })),
    };
  }

  /**
   * Revoke token (Super Admin)
   */
  async revokeToken(code: string) {
    await this.prisma.accessToken.update({
      where: { token: code },
      data: { status: TokenStatus.REVOKED },
    });

    return {
      success: true,
      message: `Token ${code} revoked successfully`,
    };
  }

  // ===================================================================
  // HELPERS
  // ===================================================================

  private generateTokenCode(prefix: string): string {
    const code = prefix
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .substring(0, 5)
      .padEnd(5, 'X');
    const unique = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${code}-${unique}`;
  }
}
