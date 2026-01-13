import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { ClerkClient } from '@clerk/backend';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../../common/enums/user-role.enum';
import { ClerkWebhookEvent } from './dto/clerk-webhook.dto';
import { AuditService } from '../audit/audit.service';

// Specialized services
import { WebhookHandlerService } from './services/webhook-handler.service';
import { ProfileUpdateService } from './services/profile-update.service';
import { AccountDeletionService } from './services/account-deletion.service';
import { DevUtilitiesService } from './services/dev-utilities.service';
import { ProfileReconciliationService } from './services/profile-reconciliation.service';

/**
 * 🎯 Auth Service (Orchestrator)
 * 
 * This service acts as a thin orchestration layer that delegates to specialized services:
 * - WebhookHandlerService: Handles all Clerk webhook events
 * - ProfileUpdateService: Handles profile updates with metadata merging
 * - AccountDeletionService: Handles account deletion
 * - DevUtilitiesService: Development utilities (token generation, super admin)
 * - ProfileReconciliationService: Periodic reconciliation between Clerk and DB
 * 
 * Business logic lives in specialized services, not here.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    // Core dependencies
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    @Inject('ClerkClient') private readonly clerkClient: ClerkClient,
    
    // Specialized services
    private readonly webhookHandler: WebhookHandlerService,
    private readonly profileUpdateService: ProfileUpdateService,
    private readonly accountDeletionService: AccountDeletionService,
    private readonly devUtilities: DevUtilitiesService,
    private readonly profileReconciliation: ProfileReconciliationService,
  ) {}

  // ============================================
  // WEBHOOK HANDLERS (Delegate to WebhookHandlerService)
  // ============================================

  /**
   * Handle user.created webhook event
   */
  async handleUserCreated(event: ClerkWebhookEvent, eventId: string) {
    return this.webhookHandler.handleUserCreated(event, eventId);
  }

  /**
   * Handle user.updated webhook event
   */
  async handleUserUpdated(event: ClerkWebhookEvent, eventId: string) {
    return this.webhookHandler.handleUserUpdated(event, eventId);
  }

  /**
   * Handle user.deleted webhook event
   */
  async handleUserDeleted(event: ClerkWebhookEvent, eventId: string) {
    return this.webhookHandler.handleUserDeleted(event, eventId);
  }

  // ============================================
  // USER PROFILE OPERATIONS
  // ============================================

  /**
   * Update user profile (Delegate to ProfileUpdateService)
   */
  async updateProfile(
    clerkId: string,
    updateProfileDto: UpdateProfileDto,
    userId: string,
    requestId?: string,
    ipAddress?: string,
  ) {
    return this.profileUpdateService.updateProfile(
      clerkId,
      updateProfileDto,
      userId,
      requestId || 'unknown',
      ipAddress || 'unknown',
    );
  }

  /**
   * Delete user account (Delegate to AccountDeletionService)
   */
  async deleteAccount(
    clerkId: string,
    userId: string,
    requestId?: string,
    ipAddress?: string,
  ) {
    return this.accountDeletionService.deleteAccount(
      clerkId,
      userId,
      requestId || 'unknown',
      ipAddress || 'unknown',
    );
  }

  // ============================================
  // ROLE MANAGEMENT
  // ============================================

  /**
   * Promote student to admin
   * 
   * This stays in AuthService as it's a specific business operation
   * that doesn't fit cleanly into any specialized service.
   */
  async promoteStudentToAdmin(
    userId: string,
    promotedBy: string,
    requestId?: string,
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.STUDENT) {
      throw new BadRequestException('Only students can be promoted to admin');
    }

    // 1️⃣ Update Clerk (source of truth)
    await this.clerkClient.users.updateUser(user.clerkId, {
      publicMetadata: { role: UserRole.ADMIN },
      privateMetadata: { role: UserRole.ADMIN },
    });

    // 2️⃣ Update DB
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.ADMIN },
    });

    // 3️⃣ Audit
    await this.auditService.logRoleChange(
      promotedBy,
      UserRole.STUDENT,
      UserRole.ADMIN,
      requestId || 'unknown',
      ipAddress || 'unknown',
    );

    return updatedUser;
  }

  // ============================================
  // RECONCILIATION (Delegate to ProfileReconciliationService)
  // ============================================

  /**
   * Get reconciliation statistics
   */
  async getReconciliationStats() {
    return this.profileReconciliation.getReconciliationStats();
  }

  /**
   * Manual reconciliation for a single user
   */
  async reconcileUser(clerkId: string) {
    return this.profileReconciliation.reconcileUser(clerkId);
  }

  /**
   * Full reconciliation of all users (SUPER_ADMIN only)
   */
  async reconcileAllUsers(initiatedBy: string) {
    return this.profileReconciliation.reconcileAllUsers(initiatedBy);
  }

  // ============================================
  // DEV/TEST UTILITIES (Delegate to DevUtilitiesService)
  // ============================================

  /**
   * Generate test token for API testing (DEV ONLY)
   */
  async generateTestToken(email: string, templateName: string = 'api-testing') {
    return this.devUtilities.generateTestToken(email, templateName);
  }

  /**
   * Create super admin (DEV ONLY)
   */
  async createSuperAdmin(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) {
    return this.devUtilities.createSuperAdmin(email, password, firstName, lastName);
  }
}