// src/modules/access-tokens/access-tokens.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GenerateTokenDto } from './dto/generate-token.dto';
import { TokenType, TokenStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { TokenValidationResult, TokenGenerationResult } from './entities/access-tokens.entity';

@Injectable()
export class AccessTokensService {
  private readonly logger = new Logger(AccessTokensService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a new access token
   */
  async generateToken(dto: GenerateTokenDto): Promise<TokenGenerationResult> {
    this.logger.log(`Generating ${dto.type} token for ${dto.email} at ${dto.school}`);

    // Validate maxUsage for ENTERPRISE tokens
    if (dto.type === TokenType.ENTERPRISE && !dto.maxUsage) {
      throw new BadRequestException('maxUsage is required for ENTERPRISE tokens');
    }

    if (dto.type === TokenType.INDIVIDUAL && dto.maxUsage) {
      this.logger.warn('maxUsage provided for INDIVIDUAL token will be ignored');
    }

    // Generate unique token string using school name
    const tokenString = this.createTokenString(dto.school);

    // Set expiration and max usage based on type
    const { expiresAt, maxUsage } = this.getTokenConfig(dto.type, dto.maxUsage);

    try {
      const accessToken = await this.prisma.accessToken.create({
        data: {
          token: tokenString,
          email: dto.email,
          name: dto.name,
          school: dto.school,
          type: dto.type,
          status: TokenStatus.ACTIVE,
          maxUsage,
          expiresAt,
          usageCount: 0,
        },
      });

      this.logger.log(`Token generated successfully: ${accessToken.id}`);

      return {
        success: true,
        tokenId: accessToken.id,
        token: accessToken.token,
        expiresAt: accessToken.expiresAt,
        maxUsage: accessToken.maxUsage,
        message: 'Token generated successfully and sent to email',
      };
    } catch (error) {
      this.logger.error('Failed to generate token', error);
      throw new BadRequestException('Failed to generate access token');
    }
  }

  /**
   * Validate an access token
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    this.logger.log(`Validating token: ${token.substring(0, 10)}...`);

    const accessToken = await this.prisma.accessToken.findUnique({
      where: { token },
    });

    if (!accessToken) {
      return {
        valid: false,
        reason: 'Token not found',
      };
    }

    // Check if expired
    if (new Date() > accessToken.expiresAt) {
      await this.updateTokenStatus(accessToken.id, TokenStatus.EXPIRED);
      return {
        valid: false,
        reason: 'Token has expired',
      };
    }

    // Check status
    if (accessToken.status !== TokenStatus.ACTIVE) {
      return {
        valid: false,
        reason: `Token is ${accessToken.status.toLowerCase()}`,
      };
    }

    // Check usage limit
    if (accessToken.usageCount >= accessToken.maxUsage) {
      await this.updateTokenStatus(accessToken.id, TokenStatus.USED);
      return {
        valid: false,
        reason: 'Token usage limit exceeded',
      };
    }

    return {
      valid: true,
      token: accessToken,
    };
  }

  /**
   * Mark token as used and increment usage count
   */
  async markTokenUsed(token: string): Promise<void> {
    this.logger.log(`Marking token as used: ${token.substring(0, 10)}...`);

    const accessToken = await this.prisma.accessToken.findUnique({
      where: { token },
    });

    if (!accessToken) {
      throw new NotFoundException('Token not found');
    }

    const now = new Date();
    const newUsageCount = accessToken.usageCount + 1;
    const newStatus = newUsageCount >= accessToken.maxUsage ? TokenStatus.USED : TokenStatus.ACTIVE;

    await this.prisma.accessToken.update({
      where: { token },
      data: {
        usageCount: newUsageCount,
        status: newStatus,
        firstUsedAt: accessToken.firstUsedAt || now,
        lastUsedAt: now,
      },
    });

    this.logger.log(`Token usage updated: ${newUsageCount}/${accessToken.maxUsage}`);
  }

  /**
   * Get token status and details
   */
  async getTokenStatus(token: string) {
    const accessToken = await this.prisma.accessToken.findUnique({
      where: { token },
    });

    if (!accessToken) {
      throw new NotFoundException('Token not found');
    }

    return {
      id: accessToken.id,
      token: accessToken.token,
      type: accessToken.type,
      status: accessToken.status,
      usageCount: accessToken.usageCount,
      maxUsage: accessToken.maxUsage,
      expiresAt: accessToken.expiresAt,
      createdAt: accessToken.createdAt,
    };
  }

  /**
   * Revoke a token
   */
  async revokeToken(token: string): Promise<void> {
    await this.updateTokenStatus(token, TokenStatus.REVOKED);
    this.logger.log(`Token revoked: ${token.substring(0, 10)}...`);
  }

  /**
   * Private helper: Update token status
   */
  private async updateTokenStatus(tokenIdOrString: string, status: TokenStatus): Promise<void> {
    // Check if it's a UUID (id) or token string
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tokenIdOrString,
    );

    if (isUuid) {
      await this.prisma.accessToken.update({
        where: { id: tokenIdOrString },
        data: { status },
      });
    } else {
      await this.prisma.accessToken.update({
        where: { token: tokenIdOrString },
        data: { status },
      });
    }
  }

  /**
   * Private helper: Generate unique token string
   * Format: SCHOOLCODE-XXXX (5 chars from school + 4 char unique ID)
   * Example: STANF-A3F8 (Stanford University)
   */
  private createTokenString(schoolName: string): string {
    // Extract first 5 characters from school name (alphanumeric only, uppercase)
    const schoolCode = schoolName
      .replace(/[^a-zA-Z0-9]/g, '') // Remove non-alphanumeric
      .toUpperCase()
      .substring(0, 5)
      .padEnd(5, 'X'); // Pad with X if less than 5 chars

    // Generate 4-character unique identifier
    const uniqueId = crypto.randomBytes(2).toString('hex').toUpperCase();

    return `${schoolCode}-${uniqueId}`;
  }

  /**
   * Private helper: Calculate checksum for token validation
   */
  private calculateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 4).toUpperCase();
  }

  /**
   * Private helper: Get token configuration based on type
   */
  private getTokenConfig(
    type: TokenType,
    providedMaxUsage?: number,
  ): {
    expiresAt: Date;
    maxUsage: number;
  } {
    const now = new Date();

    if (type === TokenType.INDIVIDUAL) {
      return {
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
        maxUsage: 1,
      };
    } else {
      // ENTERPRISE - use provided maxUsage
      return {
        expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
        maxUsage: providedMaxUsage!,
      };
    }
  }

  /**
   * Cleanup expired tokens (can be run as a cron job)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.accessToken.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        status: { not: TokenStatus.EXPIRED },
      },
      data: {
        status: TokenStatus.EXPIRED,
      },
    });

    this.logger.log(`Marked ${result.count} tokens as expired`);
    return result.count;
  }
}
