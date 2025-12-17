import { Injectable, NotFoundException, Logger, BadRequestException, Inject } from '@nestjs/common';
import { User as ClerkUser, ClerkClient } from '@clerk/backend';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserRole as PrismaUserRole, AccountStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { UserRole, isValidUserRole } from '../../../common/enums/user-role.enum';
import { ClerkWebhookEvent } from './dto/clerk-webhook.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly isDevelopment: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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
  async handleUserCreated(event: ClerkWebhookEvent) {
    const { data } = event;

    try {
      const email = data.email_addresses[0]?.email_address;
      if (!email) {
        throw new BadRequestException('Email is required');
      }

      // Determine role from metadata with fallback to STUDENT
      const role = this.extractRoleFromMetadata(data.public_metadata, data.private_metadata);

      // Extract custom fields from public metadata
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
      return user;
    } catch (error) {
      this.logger.error('Error handling user.created webhook:', error);
      throw error;
    }
  }

  /**
   * Handle user.updated webhook event
   * Syncs user updates from Clerk to database
   */
  async handleUserUpdated(event: ClerkWebhookEvent) {
    const { data } = event;

    try {
      const email = data.email_addresses[0]?.email_address;
      const role = this.extractRoleFromMetadata(data.public_metadata, data.private_metadata);
      const customFields = data.public_metadata || {};

      const user = await this.prisma.user.update({
        where: { clerkId: data.id },
        data: {
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
  async handleUserDeleted(event: ClerkWebhookEvent) {
    const { data } = event;

    try {
      await this.prisma.user.delete({
        where: { clerkId: data.id },
      });

      this.logger.log(`✅ User deleted via webhook: ${data.id}`);
    } catch (error) {
      if (error.code === 'P2025') {
        this.logger.warn(`User ${data.id} not found in database for deletion`);
        return; // User already deleted or never existed
      }
      this.logger.error('Error handling user.deleted webhook:', error);
      throw error;
    }
  }

  /**
   * Extract role from Clerk metadata with priority:
   * 1. privateMetadata.role (set by admins)
   * 2. publicMetadata.role (set by user/system)
   * 3. Default to STUDENT
   */
  private extractRoleFromMetadata(
    publicMetadata: Record<string, any>,
    privateMetadata: Record<string, any>,
  ): UserRole {
    // Priority 1: Private metadata (admin-set, more secure)
    const privateRole = privateMetadata?.role;
    if (privateRole && isValidUserRole(privateRole)) {
      return privateRole as UserRole;
    }

    // Priority 2: Public metadata
    const publicRole = publicMetadata?.role;
    if (publicRole && isValidUserRole(publicRole)) {
      return publicRole as UserRole;
    }

    // Default
    return UserRole.STUDENT;
  }

  // ============================================
  // USER PROFILE OPERATIONS
  // ============================================

  /**
   * Get current user from database
   * If not found, sync from Clerk (fallback for webhook failures)
   */
  async getCurrentUser(clerkId: string) {
    let user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        role: true,
        status: true,
        phoneNumber: true,
        dateOfBirth: true,
        grade: true,
        school: true,
        bio: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Fallback: If user not in DB, sync from Clerk
    if (!user) {
      this.logger.warn(`User ${clerkId} not found in DB, syncing from Clerk...`);
      const clerkUser = await this.clerkClient.users.getUser(clerkId);
      user = await this.syncUserFromClerk(clerkUser);
    }

    return user;
  }

  /**
   * Manual sync from Clerk (fallback for webhook failures)
   */
  private async syncUserFromClerk(clerkUser: ClerkUser) {
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      throw new BadRequestException('User has no email address');
    }

    const role = this.extractRoleFromMetadata(
      clerkUser.publicMetadata as Record<string, any>,
      clerkUser.privateMetadata as Record<string, any>,
    );

    const customFields = (clerkUser.publicMetadata as Record<string, any>) || {};

    return await this.prisma.user.upsert({
      where: { clerkId: clerkUser.id },
      create: {
        clerkId: clerkUser.id,
        email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
        role: role as PrismaUserRole,
        status: AccountStatus.ACTIVE,
        school: customFields.school as string,
        grade: customFields.grade as string,
        bio: customFields.bio as string,
        dateOfBirth: customFields.dateOfBirth ? new Date(customFields.dateOfBirth as string) : null,
        lastLoginAt: new Date(),
      },
      update: {
        email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
        role: role as PrismaUserRole,
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * Update user profile - syncs to BOTH database AND Clerk
   */
  async updateProfile(clerkId: string, updateProfileDto: UpdateProfileDto) {
    // 1. Update database first
    const user = await this.prisma.user.update({
      where: { clerkId },
      data: updateProfileDto,
    });

    // 2. Sync to Clerk metadata (for custom fields)
    const metadataUpdates: Record<string, any> = {};

    if (updateProfileDto.school !== undefined) metadataUpdates.school = updateProfileDto.school;
    if (updateProfileDto.grade !== undefined) metadataUpdates.grade = updateProfileDto.grade;
    if (updateProfileDto.bio !== undefined) metadataUpdates.bio = updateProfileDto.bio;
    if (updateProfileDto.dateOfBirth !== undefined)
      metadataUpdates.dateOfBirth = updateProfileDto.dateOfBirth;

    // 3. Update Clerk user (built-in fields + metadata)
    const clerkUpdates: any = {};

    if (updateProfileDto.firstName) clerkUpdates.firstName = updateProfileDto.firstName;
    if (updateProfileDto.lastName) clerkUpdates.lastName = updateProfileDto.lastName;

    // Update public metadata with custom fields
    if (Object.keys(metadataUpdates).length > 0) {
      clerkUpdates.publicMetadata = metadataUpdates;
    }

    if (Object.keys(clerkUpdates).length > 0) {
      await this.clerkClient.users.updateUser(clerkId, clerkUpdates);
      this.logger.log(`✅ Synced profile update to Clerk for user: ${clerkId}`);
    }

    return user;
  }

  /**
   * Delete user account - deletes from Clerk (webhook will delete from DB)
   */
  async deleteAccount(clerkId: string) {
    try {
      // Delete from Clerk first
      await this.clerkClient.users.deleteUser(clerkId);

      this.logger.log(`✅ User deleted from Clerk: ${clerkId}`);

      // Webhook will handle DB deletion, but do it here too for immediate response
      await this.prisma.user.delete({
        where: { clerkId },
      });

      return {
        message: 'Account deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting account:', error);
      throw new BadRequestException('Failed to delete account');
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

      // Ensure user exists in DB
      await this.syncUserFromClerk(clerkUser);

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

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }
}
