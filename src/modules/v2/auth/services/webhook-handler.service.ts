import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { UserRole as PrismaUserRole, AccountStatus } from '@prisma/client';
import { ClerkWebhookEvent } from '../dto/clerk-webhook.dto';
import { WebhookIdempotencyService } from './webhook-idempotency.service';
import { AuditService } from '../../audit/audit.service';
import { extractRoleFromMetadata } from '../../../../common/utils/role-metadata.util';

/**
 * 🔔 Webhook Handler Service
 * 
 * Handles all Clerk webhook events:
 * - user.created: Create user in database
 * - user.updated: Sync user updates to database
 * - user.deleted: Soft delete user in database
 */
@Injectable()
export class WebhookHandlerService {
  private readonly logger = new Logger(WebhookHandlerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookIdempotency: WebhookIdempotencyService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Handle user.created webhook event
   * Creates user in database when they sign up in Clerk
   */
  async handleUserCreated(event: ClerkWebhookEvent, eventId: string) {
    const { data } = event;

    // Check idempotency first
    const shouldProcess = await this.webhookIdempotency.shouldProcess(eventId, event.type);
    if (!shouldProcess) {
      this.logger.log(`Skipping duplicate user.created event: ${eventId}`);
      return;
    }

    try {
      const email = data.email_addresses[0]?.email_address;
      if (!email) {
        throw new BadRequestException('Email is required');
      }

      // Extract role and custom fields
      const role = extractRoleFromMetadata(data.public_metadata, data.private_metadata);
      const customFields = data.public_metadata || {};

      const user = await this.prisma.user.create({
        data: {
          clerkId: data.id,
          email,
          firstName: data.first_name,
          lastName: data.last_name,
          imageUrl: data.image_url,
          role: role as PrismaUserRole,
          status: AccountStatus.ACTIVE,
          school: customFields.school as string,
          grade: customFields.grade as string,
          bio: customFields.bio as string,
          dateOfBirth: customFields.dateOfBirth
            ? new Date(customFields.dateOfBirth as string)
            : null,
          lastLoginAt: new Date(),
        },
      });

      this.logger.log(`✅ User created via webhook: ${email} (${role})`);

      // Audit log
      await this.auditService.logWebhookUserCreated(user.id, user.clerkId, eventId);

      return user;
    } catch (error) {
      this.logger.error('Error handling user.created webhook:', error);

      // Return 200 for known errors to prevent Clerk retry
      if (error.code === 'P2002') {
        this.logger.warn(`User already exists: ${data.id}`);
        return;
      }

      throw error;
    }
  }

  /**
   * Handle user.updated webhook event
   * Syncs user updates from Clerk to database
   */
  async handleUserUpdated(event: ClerkWebhookEvent, eventId: string) {
    const { data } = event;

    // Check idempotency
    const shouldProcess = await this.webhookIdempotency.shouldProcess(eventId, event.type);
    if (!shouldProcess) {
      this.logger.log(`Skipping duplicate user.updated event: ${eventId}`);
      return;
    }

    try {
      const email = data.email_addresses[0]?.email_address;
      const role = extractRoleFromMetadata(data.public_metadata, data.private_metadata);
      const customFields = data.public_metadata || {};

      // Use upsert to handle missing users
      const user = await this.prisma.user.upsert({
        where: { clerkId: data.id },
        update: {
          email,
          firstName: data.first_name,
          lastName: data.last_name,
          imageUrl: data.image_url,
          role: role as PrismaUserRole,
          school: customFields.school as string,
          grade: customFields.grade as string,
          bio: customFields.bio as string,
          dateOfBirth: customFields.dateOfBirth
            ? new Date(customFields.dateOfBirth as string)
            : null,
          lastLoginAt: new Date(),
        },
        create: {
          clerkId: data.id,
          email,
          firstName: data.first_name,
          lastName: data.last_name,
          imageUrl: data.image_url,
          role: role as PrismaUserRole,
          status: AccountStatus.ACTIVE,
          school: customFields.school as string,
          grade: customFields.grade as string,
          bio: customFields.bio as string,
          dateOfBirth: customFields.dateOfBirth
            ? new Date(customFields.dateOfBirth as string)
            : null,
          lastLoginAt: new Date(),
        },
      });

      this.logger.log(`✅ User updated via webhook: ${email}`);
      return user;
    } catch (error) {
      this.logger.error('Error handling user.updated webhook:', error);
      throw error;
    }
  }

  /**
   * Handle user.deleted webhook event
   * Soft deletes user from database when deleted in Clerk
   */
  async handleUserDeleted(event: ClerkWebhookEvent, eventId: string) {
    const { data } = event;

    // Check idempotency
    const shouldProcess = await this.webhookIdempotency.shouldProcess(eventId, event.type);
    if (!shouldProcess) {
      this.logger.log(`Skipping duplicate user.deleted event: ${eventId}`);
      return;
    }

    try {
      // Soft delete instead of hard delete
      await this.prisma.user.update({
        where: { clerkId: data.id },
        data: {
          status: AccountStatus.INACTIVE,
          deletedAt: new Date(),
        },
      });

      this.logger.log(`✅ User soft-deleted via webhook: ${data.id}`);

      // Audit log
      await this.auditService.logWebhookUserDeleted(data.id, eventId);
    } catch (error) {
      if (error.code === 'P2025') {
        this.logger.warn(`User ${data.id} not found for deletion`);
        return; // User already deleted or never existed
      }
      this.logger.error('Error handling user.deleted webhook:', error);
      throw error;
    }
  }
}