 

/**
 * Scoring Constants - Updated with better matching thresholds
 * All magic numbers and configuration values in one place
 */

// Tier thresholds for career readiness levels
export const TIER_THRESHOLDS = {
  LEADER: 181,      // Top tier: Strong match across all areas
  INNOVATOR: 121,   // High tier: Well-developed interests
  APPRENTICE: 61,   // Mid tier: Emerging interests
  EXPLORER: 0,      // Entry tier: Starting to explore
} as const;

// Tier names
export const TIER_NAMES = {
  LEADER: 'Leader',
  INNOVATOR: 'Innovator',
  APPRENTICE: 'Apprentice',
  EXPLORER: 'Explorer',
} as const;

// Score validation constraints
export const SCORE_CONSTRAINTS = {
  MIN_SCORE: 1,
  MAX_SCORE: 5,
  TOTAL_QUESTIONS: 60,
} as const;

// ✅ UPDATED: Career matching thresholds
// Now using absolute values to handle negative correlations
export const MATCH_THRESHOLDS = {
  BEST_FIT: 0.729,   // |correlation| >= 0.729 (very strong match)
  GREAT_FIT: 0.608,  // |correlation| >= 0.608 (strong match)
  GOOD_FIT: 0.0,     // |correlation| >= 0.0 (all matches are at least good)
} as const;

// Match type names
export const MATCH_TYPES = {
  BEST_FIT: 'BEST_FIT',
  GREAT_FIT: 'GREAT_FIT',
  GOOD_FIT: 'GOOD_FIT',
} as const;

// ✅ NEW: Match quality descriptions for UI
export const MATCH_DESCRIPTIONS = {
  BEST_FIT: 'Excellent match - Your interests strongly align with this career',
  GREAT_FIT: 'Great match - Your interests align well with this career',
  GOOD_FIT: 'Good match - This career fits your profile',
} as const;

// RIASEC categories
export const RIASEC_CATEGORIES = ['R', 'I', 'A', 'S', 'E', 'C'] as const;

// ✅ NEW: RIASEC category full names for display
export const RIASEC_NAMES = {
  R: 'Realistic',
  I: 'Investigative',
  A: 'Artistic',
  S: 'Social',
  E: 'Enterprising',
  C: 'Conventional',
} as const;

// ✅ NEW: RIASEC category descriptions
export const RIASEC_DESCRIPTIONS = {
  R: 'Practical, hands-on work with tools, machines, and physical activities',
  I: 'Analytical, scientific work involving research and problem-solving',
  A: 'Creative, expressive work in arts, design, and innovation',
  S: 'People-oriented work focused on helping, teaching, and caring',
  E: 'Leadership roles in business, management, and entrepreneurship',
  C: 'Organized, detail-oriented work with data and systems',
} as const;

// Default values
export const DEFAULTS = {
  TOP_MATCHES: 10,              // Default number of career matches to return
  MAX_MATCHES: 50,              // Maximum matches to return
  MIN_MATCHES_GUARANTEED: 5,    // ✅ NEW: Minimum matches to always return (fallback)
  CACHE_TTL_MINUTES: 60,        // ✅ NEW: Cache normalized profiles for 1 hour
} as const;

// ✅ NEW: Performance thresholds
export const PERFORMANCE = {
  SLOW_QUERY_MS: 100,           // Log warning if matching takes > 100ms
  MAX_PROCESSING_TIME_MS: 5000, // Fail-safe timeout
} as const;

// ✅ NEW: Validation rules
export const VALIDATION = {
  MIN_CAREERS_IN_DB: 10,        // Minimum careers needed for valid matching
  MAX_PREFERENCE_TAGS: 10,      // Maximum tags user can select
  MAX_JOB_ZONE: 5,              // Maximum job zone value
  MIN_JOB_ZONE: 1,              // Minimum job zone value
} as const;

// ✅ NEW: Error messages
export const ERROR_MESSAGES = {
  NO_CAREERS: 'No careers available in the database',
  INVALID_SCORES: 'Invalid RIASEC scores provided',
  INVALID_TOP_N: 'topN must be a positive integer',
  INVALID_PREFERENCES: 'Invalid job preferences provided',
  PROCESSING_TIMEOUT: 'Career matching timed out',
  INSUFFICIENT_CAREERS: 'Not enough careers in database for matching',
} as const;

// ✅ NEW: Type guards for better TypeScript support
export type MatchType = typeof MATCH_TYPES[keyof typeof MATCH_TYPES];
export type RIASECCategory = typeof RIASEC_CATEGORIES[number];
export type TierName = typeof TIER_NAMES[keyof typeof TIER_NAMES];

// ✅ NEW: Helper to validate match type
export function isValidMatchType(value: string): value is MatchType {
  return Object.values(MATCH_TYPES).includes(value as MatchType);
}

// ✅ NEW: Helper to validate RIASEC category
export function isValidRIASECCategory(value: string): value is RIASECCategory {
  return RIASEC_CATEGORIES.includes(value as RIASECCategory);
}