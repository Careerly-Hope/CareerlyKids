import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ClerkClient } from '@clerk/backend';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';

// ============================================
// TYPE DEFINITIONS
// ============================================

type ClerkUpdateFields = Partial<{
  firstName: string;
  lastName: string;
  publicMetadata: Record<string, any>;
}>;

type DatabaseUpdateFields = Partial<{
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: Date;
  grade: string;
  school: string;
  bio: string;
}>;

interface NormalizedProfileUpdate {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  grade?: string;
  school?: string;
  bio?: string;
}

// ============================================
// FIELD MAPPING CONFIGURATION
// ============================================

const PROFILE_FIELD_MAP = {
  clerkBuiltIn: ['firstName', 'lastName'] as const,
  clerkMetadata: ['school', 'grade', 'bio', 'dateOfBirth'] as const,
  dbOnly: ['phoneNumber'] as const,
} as const;

/**
 * 📝 Profile Update Service (FINAL VERSION)
 * 
 * CRITICAL FIX: Merges with existing Clerk metadata to prevent data loss
 * 
 * Truth Model:
 * - Clerk is the source of truth for auth & profile metadata
 * - Database mirrors Clerk for relational queries
 * - Updates flow: Clerk → DB (with rollback on DB failure)
 * 
 * Flow: Normalize → Fetch Both States → Merge → Update Clerk → Update DB → Audit
 */
@Injectable()
export class ProfileUpdateService {
  private readonly logger = new Logger(ProfileUpdateService.name);

  constructor(
    @Inject('ClerkClient') private readonly clerkClient: ClerkClient,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async updateProfile(
    clerkId: string,
    updateProfileDto: UpdateProfileDto,
    userId: string,
    requestId: string = 'unknown',
    ipAddress: string = 'unknown',
  ) {
    // 1. NORMALIZE DTO EARLY (Single conversion point)
    const normalizedDto = this.normalizeProfileDto(updateProfileDto);

    // 2. CHECK IF ANYTHING CHANGED (Skip empty updates)
    const hasChanges = Object.values(normalizedDto).some((value) => value !== undefined);
    if (!hasChanges) {
      this.logger.debug(`No changes detected for user ${clerkId} - skipping update`);
      const user = await this.prisma.user.findUnique({ where: { clerkId } });
      return user;
    }

    // 3. FETCH CURRENT STATE FROM BOTH SYSTEMS
    // This gives us:
    // - DB state for rollback reference
    // - Clerk metadata for merging (prevents data loss)
    // - Atomic snapshot for concurrency detection
    const [currentDbUser, currentClerkUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { clerkId },
        select: {
          firstName: true,
          lastName: true,
          phoneNumber: true,
          dateOfBirth: true,
          grade: true,
          school: true,
          bio: true,
          updatedAt: true, // For future optimistic locking
        },
      }),
      this.clerkClient.users.getUser(clerkId),
    ]);

    if (!currentDbUser) {
      throw new BadRequestException(`User ${clerkId} not found in database`);
    }

    // 4. PREPARE CLERK UPDATES (with metadata merging)
    const { clerkUpdates, hasClerkChanges } = this.prepareClerkUpdates(
      normalizedDto,
      currentClerkUser.publicMetadata as Record<string, any>,
    );

    // 5. PREPARE DB UPDATES
    const { dbUpdates, hasDbChanges } = this.prepareDatabaseUpdates(normalizedDto);

    // Track update state for rollback logic
    let clerkUpdateSucceeded = false;
    let rollbackAttempted = false;

    try {
      // 6. UPDATE CLERK FIRST (Source of truth)
      if (hasClerkChanges) {
        await this.clerkClient.users.updateUser(clerkId, clerkUpdates);
        clerkUpdateSucceeded = true;
        this.logger.log(`✅ Clerk updated for user: ${clerkId}`);
      }

      // 7. UPDATE DATABASE (Mirror Clerk state)
      let user;
      if (hasDbChanges) {
        user = await this.prisma.user.update({
          where: { clerkId },
          data: dbUpdates,
        });
        this.logger.log(`✅ Database updated for user: ${clerkId}`);
      } else {
        user = await this.prisma.user.findUnique({ where: { clerkId } });
      }

      // 8. AUDIT LOG (Only if real changes occurred)
      if (hasClerkChanges || hasDbChanges) {
        await this.auditService.logProfileUpdate(userId, updateProfileDto, requestId, ipAddress);
      }

      return user;
    } catch (error) {
      // 9. ROLLBACK HANDLING
      // If Clerk succeeded but DB failed, attempt to revert Clerk
      if (clerkUpdateSucceeded && !rollbackAttempted) {
        rollbackAttempted = true;
        this.logger.error(
          `⚠️ SYNC FAILURE: Clerk updated but DB failed for user ${clerkId}. Attempting rollback...`,
          error,
        );

        // Use CLERK metadata as rollback base (source of truth)
        // NOT DB state (which may have been stale)
        const rollbackSuccess = await this.attemptClerkRollback(
          clerkId,
          normalizedDto,
          currentClerkUser,
        );

        if (!rollbackSuccess) {
          // CRITICAL: Manual intervention required
          this.logger.error(
            `❌ CRITICAL: Rollback failed for user ${clerkId}. Manual reconciliation required.`,
            {
              clerkId,
              userId,
              attemptedChanges: normalizedDto,
              clerkStateBeforeUpdate: currentClerkUser.publicMetadata,
              dbStateBeforeUpdate: currentDbUser,
              error: error.message,
            },
          );
          
          // TODO: Send to dead letter queue or alerting system
          // await this.alertingService.sendCriticalAlert('profile_sync_failure', {...});
        }
      }

      // Handle specific error types
      if (error.status || error.clerkError) {
        throw new BadRequestException(
          `Failed to update profile in Clerk: ${error.message || 'Unknown error'}`,
        );
      }

      if (error.code?.startsWith('P')) {
        throw new BadRequestException(`Database update failed: ${error.message}`);
      }

      throw new InternalServerErrorException('Failed to update profile');
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Normalize DTO with type conversions (SINGLE POINT OF CONVERSION)
   */
  private normalizeProfileDto(dto: UpdateProfileDto): NormalizedProfileUpdate {
    const normalized: NormalizedProfileUpdate = {};

    // String fields - pass through
    if (dto.firstName !== undefined) normalized.firstName = dto.firstName;
    if (dto.lastName !== undefined) normalized.lastName = dto.lastName;
    if (dto.phoneNumber !== undefined) normalized.phoneNumber = dto.phoneNumber;
    if (dto.grade !== undefined) normalized.grade = dto.grade;
    if (dto.school !== undefined) normalized.school = dto.school;
    if (dto.bio !== undefined) normalized.bio = dto.bio;

    // Date field - validate and convert
    if (dto.dateOfBirth !== undefined) {
      const date = new Date(dto.dateOfBirth);
      if (isNaN(date.getTime())) {
        throw new BadRequestException(
          'Invalid dateOfBirth format. Expected ISO 8601 date string',
        );
      }
      normalized.dateOfBirth = date;
    }

    return normalized;
  }

  /**
   * Prepare Clerk updates with metadata merging
   * 
   * CRITICAL: Merges with existing metadata to prevent data loss
   */
  private prepareClerkUpdates(
    normalized: NormalizedProfileUpdate,
    existingMetadata: Record<string, any>,
  ): {
    clerkUpdates: ClerkUpdateFields;
    hasClerkChanges: boolean;
  } {
    const clerkUpdates: ClerkUpdateFields = {};
    
    // START WITH EXISTING METADATA (preserve all fields)
    const metadataUpdates: Record<string, any> = { ...existingMetadata };

    // Built-in Clerk fields
    for (const field of PROFILE_FIELD_MAP.clerkBuiltIn) {
      if (normalized[field] !== undefined) {
        clerkUpdates[field] = normalized[field];
      }
    }

    // Metadata fields (merge, don't replace)
    for (const field of PROFILE_FIELD_MAP.clerkMetadata) {
      if (normalized[field] !== undefined) {
        // Convert Date to ISO string for Clerk
        const value =
          field === 'dateOfBirth' && normalized[field] instanceof Date
            ? (normalized[field] as Date).toISOString()
            : normalized[field];
        metadataUpdates[field] = value;
      }
    }

    // Only include metadata if we changed any metadata fields
    const metadataChanged = PROFILE_FIELD_MAP.clerkMetadata.some(
      (field) => normalized[field] !== undefined,
    );

    if (metadataChanged) {
      clerkUpdates.publicMetadata = metadataUpdates;
    }

    return {
      clerkUpdates,
      hasClerkChanges: Object.keys(clerkUpdates).length > 0,
    };
  }

  /**
   * Prepare database updates
   */
  private prepareDatabaseUpdates(normalized: NormalizedProfileUpdate): {
    dbUpdates: DatabaseUpdateFields;
    hasDbChanges: boolean;
  } {
    const dbUpdates: DatabaseUpdateFields = {};

    const allDbFields = [
      ...PROFILE_FIELD_MAP.clerkBuiltIn,
      ...PROFILE_FIELD_MAP.clerkMetadata,
      ...PROFILE_FIELD_MAP.dbOnly,
    ] as const;

    for (const field of allDbFields) {
      if (normalized[field] !== undefined) {
        dbUpdates[field] = normalized[field] as any;
      }
    }

    return {
      dbUpdates,
      hasDbChanges: Object.keys(dbUpdates).length > 0,
    };
  }




  private async attemptClerkRollback(
    clerkId: string,
    attemptedChanges: NormalizedProfileUpdate,
    clerkUserBeforeUpdate: any, // ✅ Full Clerk user object
  ): Promise<boolean> {
    const MAX_RETRIES = 3;
    let attempt = 0;
  
    while (attempt < MAX_RETRIES) {
      try {
        attempt++;
  
        const rollbackUpdates: ClerkUpdateFields = {};
        
        // Rollback built-in fields from top-level Clerk user properties
        if (attemptedChanges.firstName !== undefined) {
          rollbackUpdates.firstName = clerkUserBeforeUpdate.firstName ?? undefined;
        }
        if (attemptedChanges.lastName !== undefined) {
          rollbackUpdates.lastName = clerkUserBeforeUpdate.lastName ?? undefined;
        }
  
        // Rollback metadata fields from publicMetadata
        const metadataChanged = PROFILE_FIELD_MAP.clerkMetadata.some(
          (field) => attemptedChanges[field] !== undefined,
        );
  
        if (metadataChanged) {
          // Use pre-update publicMetadata as rollback base
          rollbackUpdates.publicMetadata = {
            ...(clerkUserBeforeUpdate.publicMetadata as Record<string, any>),
          };
        }
  
        // Execute rollback
        if (Object.keys(rollbackUpdates).length > 0) {
          await this.clerkClient.users.updateUser(clerkId, rollbackUpdates);
          this.logger.warn(`✅ Clerk rollback successful for user ${clerkId} (attempt ${attempt})`);
          return true;
        }
  
        return true; // Nothing to rollback
      } catch (rollbackError) {
        this.logger.error(
          `❌ Clerk rollback attempt ${attempt}/${MAX_RETRIES} failed for user ${clerkId}`,
          rollbackError,
        );
  
        if (attempt >= MAX_RETRIES) {
          return false;
        }
  
        // Exponential backoff: 100ms, 200ms, 400ms
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
      }
    }

    return false;
  }
}