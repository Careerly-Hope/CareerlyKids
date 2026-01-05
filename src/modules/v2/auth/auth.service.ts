import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { User as ClerkUser, ClerkClient } from '@clerk/backend';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserRole as PrismaUserRole, AccountStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../../common/enums/user-role.enum';
import { ClerkWebhookEvent } from './dto/clerk-webhook.dto';
import { WebhookIdempotencyService } from './webhook-idempotency.service';
import { AuditService } from '../audit/audit.service';
import { extractRoleFromMetadata } from '../../../common/utils/role-metadata.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly isDevelopment: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly webhookIdempotency: WebhookIdempotencyService,
    private readonly auditService: AuditService,
    @Inject('ClerkClient') private readonly clerkClient: ClerkClient,
  ) {
    this.isDevelopment = this.configService.get('NODE_ENV') === 'development';
  }

  // ============================================
  // WEBHOOK HANDLERS
  // ============================================

  /**
   * Handle user.created webhook event
   * Creates user in database when they sign up in Clerk
   */
  async handleUserCreated(event: ClerkWebhookEvent, eventId: string) {
    const { data } = event;

    // ✅ Check idempotency first
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

      // ✅ Audit log
      await this.auditService.logWebhookUserCreated(user.id, user.clerkId, eventId);

      return user;
    } catch (error) {
      this.logger.error('Error handling user.created webhook:', error);

      // ✅ Return 200 for known errors to prevent Clerk retry
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

    // ✅ Check idempotency
    const shouldProcess = await this.webhookIdempotency.shouldProcess(eventId, event.type);
    if (!shouldProcess) {
      this.logger.log(`Skipping duplicate user.updated event: ${eventId}`);
      return;
    }

    try {
      const email = data.email_addresses[0]?.email_address;
      const role = extractRoleFromMetadata(data.public_metadata, data.private_metadata);
      const customFields = data.public_metadata || {};

      // ✅ Use upsert to handle missing users
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
   * Deletes user from database when deleted in Clerk
   */
  async handleUserDeleted(event: ClerkWebhookEvent, eventId: string) {
    const { data } = event;

    // ✅ Check idempotency
    const shouldProcess = await this.webhookIdempotency.shouldProcess(eventId, event.type);
    if (!shouldProcess) {
      this.logger.log(`Skipping duplicate user.deleted event: ${eventId}`);
      return;
    }

    try {
      // ✅ Soft delete instead of hard delete
      await this.prisma.user.update({
        where: { clerkId: data.id },
        data: {
          status: AccountStatus.INACTIVE,
          deletedAt: new Date(),
        },
      });

      this.logger.log(`✅ User soft-deleted via webhook: ${data.id}`);

      // ✅ Audit log
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

  // ============================================
  // USER PROFILE OPERATIONS
  // ============================================

  /**
   * Update user profile - Clerk first, then database
   */
  async updateProfile(
    clerkId: string,
    updateProfileDto: UpdateProfileDto,
    userId: string,
    requestId?: string,
    ipAddress?: string,
  ) {
    // ✅ 1. Update Clerk first (source of truth)
    const clerkUpdates: any = {};
    const metadataUpdates: Record<string, any> = {};

    // Built-in Clerk fields
    if (updateProfileDto.firstName) clerkUpdates.firstName = updateProfileDto.firstName;
    if (updateProfileDto.lastName) clerkUpdates.lastName = updateProfileDto.lastName;

    // Custom fields go to metadata
    if (updateProfileDto.school !== undefined) metadataUpdates.school = updateProfileDto.school;
    if (updateProfileDto.grade !== undefined) metadataUpdates.grade = updateProfileDto.grade;
    if (updateProfileDto.bio !== undefined) metadataUpdates.bio = updateProfileDto.bio;
    if (updateProfileDto.dateOfBirth !== undefined)
      metadataUpdates.dateOfBirth = updateProfileDto.dateOfBirth;

    if (Object.keys(metadataUpdates).length > 0) {
      clerkUpdates.publicMetadata = metadataUpdates;
    }

    try {
      // Update Clerk
      if (Object.keys(clerkUpdates).length > 0) {
        await this.clerkClient.users.updateUser(clerkId, clerkUpdates);
        this.logger.log(`✅ Updated Clerk profile for user: ${clerkId}`);
      }

      // ✅ 2. Update database (mirror Clerk)
      const user = await this.prisma.user.update({
        where: { clerkId },
        data: updateProfileDto,
      });

      // ✅ 3. Audit log
      await this.auditService.logProfileUpdate(userId, updateProfileDto, requestId, ipAddress);

      return user;
    } catch (error) {
      this.logger.error('Error updating profile:', error);

      // ✅ If Clerk fails, don't update DB
      if (error.status || error.clerkError) {
        throw new BadRequestException('Failed to update profile in Clerk');
      }

      throw new InternalServerErrorException('Failed to update profile');
    }
  }

  /**
   * Delete user account - Request deletion from Clerk only
   * Webhook will handle database cleanup
   */
  async deleteAccount(
    clerkId: string,
    userId: string,
    requestId?: string,
    ipAddress?: string,
  ) {
    try {
      // ✅ Only delete from Clerk
      await this.clerkClient.users.deleteUser(clerkId);
      this.logger.log(`✅ Deletion requested from Clerk: ${clerkId}`);

      // ✅ Audit log
      await this.auditService.logAccountDeletion(userId, clerkId, requestId, ipAddress);

      // ✅ Return immediately - webhook will clean up DB
      return {
        message: 'Account deletion requested. Cleanup will complete shortly.',
      };
    } catch (error) {
      this.logger.error('Error requesting account deletion:', error);
      throw new BadRequestException('Failed to request account deletion');
    }
  }

  // ============================================
  // DEV/TEST UTILITIES
  // ============================================

  /**
   * Generate test token for API testing (DEV ONLY)
   */
  async generateTestToken(email: string, templateName: string = 'api-testing') {
    this.validateDevMode();

    try {
      const users = await this.clerkClient.users.getUserList({ emailAddress: [email] });

      if (!users.data || users.data.length === 0) {
        throw new NotFoundException(`User with email ${email} not found in Clerk`);
      }

      const clerkUser = users.data[0];

      const sessionsList = await this.clerkClient.sessions.getSessionList({
        userId: clerkUser.id,
        status: 'active',
      });

      let sessionId: string;

      if (sessionsList.data && sessionsList.data.length > 0) {
        sessionId = sessionsList.data[0].id;
      } else {
        const session = await this.clerkClient.sessions.createSession({
          userId: clerkUser.id,
        });
        sessionId = session.id;
      }

      const tokenResponse = await this.clerkClient.sessions.getToken(sessionId, templateName);

      return {
        message: 'Token generated successfully',
        user: {
          clerkId: clerkUser.id,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          role: (clerkUser.publicMetadata as any)?.role || 'STUDENT',
        },
        token: tokenResponse.jwt,
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
        howToUse: {
          swagger: 'Click "Authorize" button and paste this token',
          postman: 'Add header: Authorization: Bearer <token>',
        },
      };
    } catch (error) {
      this.logger.error('Error generating test token:', error);
      throw new BadRequestException(`Failed to generate token: ${error.message}`);
    }
  }

  /**
   * Create super admin (DEV ONLY)
   */
  async createSuperAdmin(email: string, password: string, firstName: string, lastName: string) {
    this.validateDevMode();

    try {
      // Create in Clerk with SUPER_ADMIN in private metadata
      const clerkUser = await this.clerkClient.users.createUser({
        emailAddress: [email],
        password,
        firstName,
        lastName,
        privateMetadata: {
          role: UserRole.SUPER_ADMIN,
          createdBy: 'system',
          adminLevel: 'full',
        },
        publicMetadata: {
          role: UserRole.SUPER_ADMIN,
        },
      });

      // Create in database
      const user = await this.prisma.user.create({
        data: {
          clerkId: clerkUser.id,
          email,
          firstName,
          lastName,
          imageUrl: clerkUser.imageUrl,
          role: UserRole.SUPER_ADMIN as PrismaUserRole,
          status: AccountStatus.ACTIVE,
          lastLoginAt: new Date(),
        },
      });

      this.logger.log(`✅ Super admin created: ${email}`);

      return {
        message: 'Super admin created successfully',
        user: {
          clerkId: user.clerkId,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      this.logger.error('Error creating super admin:', error);
      throw new BadRequestException(`Failed to create super admin: ${error.message}`);
    }
  }

  private validateDevMode(): void {
    if (!this.isDevelopment) {
      throw new BadRequestException('This endpoint is only available in development mode');
    }
  }
}