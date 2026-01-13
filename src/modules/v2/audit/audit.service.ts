import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface AuditLogData {
  userId?: string;
  action: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  requestId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit event
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          metadata: data.metadata || {},
          ipAddress: data.ipAddress,
          requestId: data.requestId,
        },
      });

      this.logger.log(`Audit: ${data.action} by user ${data.userId || 'system'}`);
    } catch (error) {
      // Don't fail requests if audit logging fails
      this.logger.error('Failed to write audit log:', error);
    }
  }

  /**
   * Log user profile update
   */
  async logProfileUpdate(
    userId: string,
    changes: Record<string, any>,
    requestId?: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: 'PROFILE_UPDATED',
      metadata: { changes },
      requestId,
      ipAddress,
    });
  }

  /**
   * Log account deletion
   */
  async logAccountDeletion(
    userId: string,
    clerkId: string,
    requestId?: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: 'ACCOUNT_DELETED',
      metadata: { clerkId },
      requestId,
      ipAddress,
    });
  }

  /**
   * Log role change
   */
  async logRoleChange(
    userId: string,
    oldRole: string,
    newRole: string,
    requestId?: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: 'ROLE_CHANGED',
      metadata: { oldRole, newRole },
      requestId,
      ipAddress,
    });
  }

  /**
   * Log webhook-driven user creation
   */
  async logWebhookUserCreated(userId: string, clerkId: string, eventId: string): Promise<void> {
    await this.log({
      userId,
      action: 'USER_CREATED_VIA_WEBHOOK',
      metadata: { clerkId, eventId },
    });
  }

  /**
   * Log webhook-driven user deletion
   */
  async logWebhookUserDeleted(clerkId: string, eventId: string): Promise<void> {
    await this.log({
      action: 'USER_DELETED_VIA_WEBHOOK',
      metadata: { clerkId, eventId },
    });
  }
}
