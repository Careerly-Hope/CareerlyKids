import { Inject, Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
import { ClerkClient } from '@clerk/backend';
import { PrismaService } from 'src/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * 🔄 Profile Reconciliation Service
 * 
 * Handles data consistency between Clerk and Database when sync failures occur.
 * 
 * Features:
 * - Periodic reconciliation checks (every 15 minutes)
 * - Manual reconciliation API endpoint
 * - Drift detection and alerting
 * - Automatic repair for minor inconsistencies
 */
@Injectable()
export class ProfileReconciliationService {
  private readonly logger = new Logger(ProfileReconciliationService.name);

  constructor(
    @Inject('ClerkClient') private readonly clerkClient: ClerkClient,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Periodic reconciliation job
   * Runs every 15 minutes to detect and fix drift
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async periodicReconciliation() {
    this.logger.log('🔄 Starting periodic profile reconciliation...');

    try {
      const results = await this.reconcileAllUsers();
      
      this.logger.log(
        `✅ Reconciliation complete: ${results.checked} users checked, ${results.fixed} fixed, ${results.errors} errors`,
      );

      // Alert if too many inconsistencies
      if (results.fixed > 10 || results.errors > 5) {
        this.logger.warn(
          `⚠️ High inconsistency rate detected: ${results.fixed} fixed, ${results.errors} errors`,
        );
        // await this.alertingService.sendAlert('high_profile_drift', results);
      }
    } catch (error) {
      this.logger.error('❌ Periodic reconciliation failed:', error);
    }
  }

  /**
   * Manual reconciliation for a single user
   */
  async reconcileUser(clerkId: string): Promise<{
    success: boolean;
    drift: boolean;
    changes: string[];
  }> {
    try {
      // 1. Fetch from both sources
      const [clerkUser, dbUser] = await Promise.all([
        this.clerkClient.users.getUser(clerkId),
        this.prisma.user.findUnique({ where: { clerkId } }),
      ]);

      if (!clerkUser) {
        this.logger.warn(`User ${clerkId} not found in Clerk`);
        return { success: false, drift: true, changes: ['User missing in Clerk'] };
      }

      if (!dbUser) {
        this.logger.warn(`User ${clerkId} not found in Database`);
        return { success: false, drift: true, changes: ['User missing in Database'] };
      }

      // 2. Compare fields
      const drift = this.detectDrift(clerkUser, dbUser);

      if (drift.length === 0) {
        this.logger.debug(`✅ No drift detected for user ${clerkId}`);
        return { success: true, drift: false, changes: [] };
      }

      this.logger.warn(`⚠️ Drift detected for user ${clerkId}:`, drift);

      // 3. Repair: Clerk is source of truth
      await this.repairDrift(clerkId, clerkUser, drift);

      return { success: true, drift: true, changes: drift };
    } catch (error) {
      this.logger.error(`❌ Failed to reconcile user ${clerkId}:`, error);
      return { success: false, drift: true, changes: ['Reconciliation error'] };
    }
  }

  /**
   * Reconcile all users (paginated)
   */
  private async reconcileAllUsers(): Promise<{
    checked: number;
    fixed: number;
    errors: number;
  }> {
    let checked = 0;
    let fixed = 0;
    let errors = 0;

    const BATCH_SIZE = 50;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const users = await this.prisma.user.findMany({
        take: BATCH_SIZE,
        skip: offset,
        select: { clerkId: true },
      });

      if (users.length === 0) {
        hasMore = false;
        break;
      }

      // Process batch concurrently (but rate-limited)
      const results = await Promise.allSettled(
        users.map((user) => this.reconcileUser(user.clerkId)),
      );

      for (const result of results) {
        checked++;

        if (result.status === 'fulfilled') {
          if (result.value.drift) {
            fixed++;
          }
        } else {
          errors++;
        }
      }

      offset += BATCH_SIZE;

      // Rate limiting: wait 1 second between batches to avoid Clerk API limits
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return { checked, fixed, errors };
  }

  /**
   * Detect drift between Clerk and DB
   */
  private detectDrift(clerkUser: any, dbUser: any): string[] {
    const drift: string[] = [];

    // Built-in fields
    if (clerkUser.firstName !== dbUser.firstName) {
      drift.push(`firstName: "${dbUser.firstName}" → "${clerkUser.firstName}"`);
    }
    if (clerkUser.lastName !== dbUser.lastName) {
      drift.push(`lastName: "${dbUser.lastName}" → "${clerkUser.lastName}"`);
    }

    // Metadata fields
    const metadata = clerkUser.publicMetadata || {};

    if (metadata.school !== dbUser.school) {
      drift.push(`school: "${dbUser.school}" → "${metadata.school}"`);
    }
    if (metadata.grade !== dbUser.grade) {
      drift.push(`grade: "${dbUser.grade}" → "${metadata.grade}"`);
    }
    if (metadata.bio !== dbUser.bio) {
      drift.push(`bio: "${dbUser.bio?.substring(0, 30)}..." → "${metadata.bio?.substring(0, 30)}..."`);
    }

    // Date comparison (Clerk stores as ISO string, DB as Date)
    if (metadata.dateOfBirth) {
      const clerkDate = new Date(metadata.dateOfBirth).toISOString();
      const dbDate = dbUser.dateOfBirth?.toISOString();
      if (clerkDate !== dbDate) {
        drift.push(`dateOfBirth: "${dbDate}" → "${clerkDate}"`);
      }
    }

    return drift;
  }

  /**
   * Repair drift by updating DB to match Clerk
   */
  private async repairDrift(clerkId: string, clerkUser: any, drift: string[]): Promise<void> {
    const metadata = clerkUser.publicMetadata || {};

    const updates: any = {};

    // Built-in fields
    if (drift.some((d) => d.startsWith('firstName'))) {
      updates.firstName = clerkUser.firstName;
    }
    if (drift.some((d) => d.startsWith('lastName'))) {
      updates.lastName = clerkUser.lastName;
    }

    // Metadata fields
    if (drift.some((d) => d.startsWith('school'))) {
      updates.school = metadata.school;
    }
    if (drift.some((d) => d.startsWith('grade'))) {
      updates.grade = metadata.grade;
    }
    if (drift.some((d) => d.startsWith('bio'))) {
      updates.bio = metadata.bio;
    }
    if (drift.some((d) => d.startsWith('dateOfBirth')) && metadata.dateOfBirth) {
      updates.dateOfBirth = new Date(metadata.dateOfBirth);
    }

    if (Object.keys(updates).length > 0) {
      await this.prisma.user.update({
        where: { clerkId },
        data: updates,
      });

      this.logger.log(`✅ Repaired drift for user ${clerkId}: ${drift.join(', ')}`);
    }
  }

  /**
   * Get reconciliation stats
   */
  async getReconciliationStats(): Promise<{
    totalUsers: number;
    lastCheck: Date | null;
    driftCount: number;
  }> {
    const totalUsers = await this.prisma.user.count();

    // In production, store these in Redis or a separate table
    return {
      totalUsers,
      lastCheck: new Date(), // Replace with actual last check time
      driftCount: 0, // Replace with actual drift count
    };
  }
}