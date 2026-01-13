/**
 * 🔄 Profile Reconciliation Configuration
 * 
 * Simple, tunable configuration for reconciliation service.
 * All timing and behavior settings in one place.
 */

export const RECONCILIATION_CONFIG = {
    // ============================================
    // CRON SCHEDULING
    // ============================================
    
    /**
     * Daily reconciliation at 3 AM UTC
     * Runs automatically to catch drift from previous day
     */
    CRON_SCHEDULE: '0 3 * * *', // 3 AM UTC daily
    
    /**
     * Only check users modified in last 24 hours during scheduled runs
     * Reduces API calls and focuses on recent activity
     */
    CHECK_RECENT_HOURS: 24,
    
    // ============================================
    // BATCH PROCESSING
    // ============================================
    
    /**
     * Process 50 users per batch
     * Balances performance vs memory usage
     */
    BATCH_SIZE: 50,
    
    /**
     * Wait 1 second between batches
     * Prevents Clerk API rate limiting (100 requests/10s)
     */
    BATCH_DELAY_MS: 1000,
    
    // ============================================
    // RETRY LOGIC
    // ============================================
    
    /**
     * Retry failed reconciliations 3 times
     * Handles transient network errors
     */
    MAX_RETRIES: 3,
    
    /**
     * Exponential backoff: 1s, 2s, 4s
     */
    RETRY_BASE_DELAY_MS: 1000,
    RETRY_MAX_DELAY_MS: 10000,
    
    // ============================================
    // CIRCUIT BREAKER
    // ============================================
    
    /**
     * Open circuit after 3 consecutive failures
     * Prevents hammering Clerk API when it's down
     */
    CIRCUIT_BREAKER_THRESHOLD: 3,
    
    /**
     * Keep circuit open for 30 minutes
     * Allows Clerk time to recover
     */
    CIRCUIT_BREAKER_TIMEOUT_MS: 30 * 60 * 1000,
    
    // ============================================
    // RATE LIMITING (Manual Endpoints)
    // ============================================
    
    /**
     * Prevent full scan abuse
     * Only allow once per hour
     */
    MANUAL_FULL_SCAN_COOLDOWN_MS: 60 * 60 * 1000, // 1 hour
    
    // ============================================
    // RACE CONDITION PREVENTION
    // ============================================
    
    /**
     * Skip users updated in last 5 minutes
     * Avoids race with ongoing profile updates
     */
    SKIP_RECENT_UPDATES_MS: 5 * 60 * 1000,
    
    // ============================================
    // USER FILTERING
    // ============================================
    
    /**
     * Skip test users (clerkId starts with these)
     */
    TEST_USER_PREFIXES: ['test_', 'dev_', 'demo_'],
    
    // ============================================
    // ALERTING THRESHOLDS
    // ============================================
    
    /**
     * Alert if too many inconsistencies found
     */
    ALERT_THRESHOLD_FIXED: 10,
    ALERT_THRESHOLD_ERRORS: 5,
  } as const;
  
  /**
   * Helper: Check if user is a test user
   */
  export function isTestUser(clerkId: string): boolean {
    return RECONCILIATION_CONFIG.TEST_USER_PREFIXES.some((prefix) =>
      clerkId.startsWith(prefix),
    );
  }
  
  /**
   * Helper: Normalize nullish values for comparison
   * Treats null, undefined, and empty string as equivalent
   */
  export function normalizeValue<T>(value: T | null | undefined): T | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    return value;
  }