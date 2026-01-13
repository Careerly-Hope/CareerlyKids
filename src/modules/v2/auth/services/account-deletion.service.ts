import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { ClerkClient } from '@clerk/backend';
import { AuditService } from '../../audit/audit.service';

/**
 * 🗑️ Account Deletion Service
 *
 * Handles account deletion through Clerk.
 * Database cleanup happens automatically via webhook.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @Inject('ClerkClient') private readonly clerkClient: ClerkClient,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Delete user account - Request deletion from Clerk only
   * Webhook will handle database cleanup
   */
  async deleteAccount(
    clerkId: string,
    userId: string,
    requestId: string = 'unknown',
    ipAddress: string = 'unknown',
  ) {
    try {
      // Only delete from Clerk
      await this.clerkClient.users.deleteUser(clerkId);
      this.logger.log(`✅ Deletion requested from Clerk: ${clerkId}`);

      // Audit log
      await this.auditService.logAccountDeletion(userId, clerkId, requestId, ipAddress);

      // Return immediately - webhook will clean up DB
      return {
        message: 'Account deletion requested. Cleanup will complete shortly.',
      };
    } catch (error) {
      this.logger.error('Error requesting account deletion:', error);
      throw new BadRequestException('Failed to request account deletion');
    }
  }
}
