/**
 * 📦 Reconciliation DTOs
 *
 * Response types for reconciliation endpoints
 */

/**
 * Result of reconciling a single user
 */
export interface ReconcileUserResult {
  success: boolean;
  drift: boolean;
  changes: string[];
  error?: string;
}

/**
 * Summary of full reconciliation run
 */
export interface ReconciliationSummary {
  checked: number;
  fixed: number;
  errors: number;
  skipped: number;
  duration: number; // milliseconds
}

/**
 * Stats endpoint response
 */
export class ReconciliationStatsDto {
  totalUsers: number;
  activeUsers: number;
  lastScheduledRun: Date | null;
  lastManualRun: Date | null;
  nextScheduledRun: string; // Human-readable like "Tomorrow at 3:00 AM UTC"
  recentDrift: {
    last24h: number;
    last7d: number;
  };
}

/**
 * Single user reconciliation response
 */
export class ReconcileUserResponseDto {
  clerkId: string;
  driftDetected: boolean;
  changes: string[];
  repaired: boolean;
  message: string;
}

/**
 * Full reconciliation response
 */
export class FullReconciliationResponseDto {
  started: boolean;
  estimatedTime: string;
  message: string;
  jobId?: string; // Future: for async processing
}

/**
 * Full reconciliation result (when complete)
 */
export class FullReconciliationResultDto {
  summary: ReconciliationSummary;
  timestamp: Date;
  initiatedBy: string;
  details: {
    usersChecked: string[];
    usersRepaired: string[];
    usersFailed: string[];
  };
}
