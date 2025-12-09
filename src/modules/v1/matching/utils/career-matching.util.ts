import {
  DEFAULTS,
  MATCH_THRESHOLDS,
  MATCH_TYPES,
  RIASEC_CATEGORIES,
} from '../../scoring/constants/scoring.constants';
import { RIASECScores } from '../../scoring/utils/riasec-scoring.util';

export interface CareerMatch {
  careerId: number;
  careerName: string;
  description: string;
  profile: RIASECScores;
  jobZone: number;
  tags: string[];
  correlation: number;
  matchType: string;
  matchScore: number; // 0-100 normalized score for better UX
}

export interface MatchStatistics {
  total: number;
  bestFit: number;
  greatFit: number;
  goodFit: number;
  avgCorrelation: number;
  skippedCareers: number;
  processingTimeMs: number;
}

export interface JobPreferences {
  preferredJobZones?: number[];
  preferredTags?: string[];
  excludeTags?: string[];
  minJobZone?: number;
  maxJobZone?: number;
}

export interface CareerFromDB {
  id: number;
  careerName: string;
  description: string;
  profile: any;
  jobZone: number;
  tags: string[];
}

/**
 * ✅ OPTIMIZED: Normalize profile with tolerance for missing fields
 * Time Complexity: O(1) - constant number of categories
 */
function normalizeProfile(profile: any): RIASECScores | null {
  try {
    if (!profile) return null;

    const data = typeof profile === 'string' ? JSON.parse(profile) : profile;
    const normalized: any = {};

    // ✅ TOLERANT: Fill missing values with 0 instead of rejecting
    for (const cat of RIASEC_CATEGORIES) {
      const value = data[cat];

      if (value === null || value === undefined) {
        normalized[cat] = 0; // Default to 0 for missing
      } else if (typeof value === 'number' && !isNaN(value)) {
        normalized[cat] = Math.max(0, value); // Ensure non-negative
      } else {
        // Try to parse if it's a string number
        const parsed = Number(value);
        if (!isNaN(parsed)) {
          normalized[cat] = Math.max(0, parsed);
        } else {
          console.warn(`Invalid value for ${cat}:`, value);
          return null; // Only reject if truly invalid
        }
      }
    }

    return normalized as RIASECScores;
  } catch (error) {
    console.error('Profile normalization failed:', error);
    return null;
  }
}

/**
 * ✅ OPTIMIZED: Pearson correlation with numerical stability
 * Time Complexity: O(k) where k = number of RIASEC categories (6)
 */
export function pearsonCorrelation(profile1: RIASECScores, profile2: RIASECScores): number {
  const x = RIASEC_CATEGORIES.map((cat) => profile1[cat]);
  const y = RIASEC_CATEGORIES.map((cat) => profile2[cat]);
  const n = x.length;

  // Calculate means
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;

  // Calculate correlation components
  let numerator = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    sumX2 += diffX * diffX;
    sumY2 += diffY * diffY;
  }

  // Handle edge cases
  const denominator = Math.sqrt(sumX2 * sumY2);
  if (denominator === 0) return 0; // No variation in one or both profiles

  const correlation = numerator / denominator;

  // Clamp to valid range due to floating point errors
  return Math.max(-1, Math.min(1, correlation));
}

/**
 * ✅ IMPROVED: Match type now handles ALL correlations
 * Negative correlations indicate opposite interests (still valid matches)
 */
export function getMatchType(correlation: number): string {
  const absCorr = Math.abs(correlation);

  if (absCorr >= MATCH_THRESHOLDS.BEST_FIT) return MATCH_TYPES.BEST_FIT;
  if (absCorr >= MATCH_THRESHOLDS.GREAT_FIT) return MATCH_TYPES.GREAT_FIT;
  return MATCH_TYPES.GOOD_FIT; // Everything else is at least GOOD_FIT
}

/**
 * ✅ NEW: Convert correlation to 0-100 match score for better UX
 * Negative correlations get lower scores but are still valid
 */
function correlationToMatchScore(correlation: number): number {
  // Map [-1, 1] to [0, 100]
  // Positive correlations: 50-100
  // Negative correlations: 0-49
  return Math.round(((correlation + 1) / 2) * 100);
}

/**
 * ✅ NEW: Quick filter check before full matching
 * Time Complexity: O(1) per career
 */
function passesPreferenceFilter(career: CareerFromDB, preferences?: JobPreferences): boolean {
  if (!preferences) return true;

  // Job zone filters
  if (preferences.preferredJobZones?.length) {
    if (!preferences.preferredJobZones.includes(career.jobZone)) return false;
  }

  if (preferences.minJobZone && career.jobZone < preferences.minJobZone) {
    return false;
  }

  if (preferences.maxJobZone && career.jobZone > preferences.maxJobZone) {
    return false;
  }

  // Tag filters
  const careerTags = career.tags || [];

  if (preferences.excludeTags?.length) {
    const hasExcludedTag = preferences.excludeTags.some((tag) => careerTags.includes(tag));
    if (hasExcludedTag) return false;
  }

  if (preferences.preferredTags?.length) {
    const hasPreferredTag = preferences.preferredTags.some((tag) => careerTags.includes(tag));
    if (!hasPreferredTag) return false;
  }

  return true;
}

/**
 * ✅ OPTIMIZED: Main matching engine with improved algorithm
 * Time Complexity: O(n * k) where n = careers, k = 6 (RIASEC categories)
 * Space Complexity: O(m) where m = valid matches
 *
 * IMPROVEMENTS:
 * 1. Filter BEFORE matching (not after) - reduces computations
 * 2. All correlations accepted (no null matches)
 * 3. Guaranteed non-empty results with fallback
 * 4. Better error collection and reporting
 */
export function matchCareers(
  userScores: RIASECScores,
  careers: CareerFromDB[],
  preferences?: JobPreferences,
  topN: number = DEFAULTS.TOP_MATCHES,
): CareerMatch[] {
  const startTime = performance.now();

  // Validation
  if (!careers || !Array.isArray(careers)) {
    throw new Error('Careers must be a valid array');
  }
  if (careers.length === 0) return [];
  if (topN < 1) throw new Error('topN must be at least 1');

  const matches: CareerMatch[] = [];
  let skippedCount = 0;
  const errors: string[] = [];

  // ✅ OPTIMIZATION 1: Filter careers BEFORE matching
  const filteredCareers = preferences
    ? careers.filter((c) => passesPreferenceFilter(c, preferences))
    : careers;

  console.log(
    `Matching ${filteredCareers.length}/${careers.length} careers after preference filtering`,
  );

  // ✅ OPTIMIZATION 2: Process all valid careers
  filteredCareers.forEach((career) => {
    const careerProfile = normalizeProfile(career.profile);

    if (!careerProfile) {
      skippedCount++;
      errors.push(`Career ${career.id} (${career.careerName}): invalid profile`);
      return;
    }

    try {
      const correlation = pearsonCorrelation(userScores, careerProfile);
      const matchType = getMatchType(correlation);
      const matchScore = correlationToMatchScore(correlation);

      // ✅ IMPROVEMENT: ALL matches are valid now
      matches.push({
        careerId: career.id,
        careerName: career.careerName,
        description: career.description,
        profile: careerProfile,
        jobZone: career.jobZone,
        tags: career.tags || [],
        correlation,
        matchType,
        matchScore,
      });
    } catch (error) {
      skippedCount++;
      errors.push(
        `Career ${career.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  });

  // ✅ IMPROVEMENT 3: Guaranteed non-empty results
  if (matches.length === 0) {
    console.warn('⚠️ No matches found with current criteria. Providing fallback matches...');

    // Fallback: Match ALL careers without preferences
    const fallbackMatches = careers
      .map((career) => {
        const profile = normalizeProfile(career.profile);
        if (!profile) return null;

        const correlation = pearsonCorrelation(userScores, profile);
        return {
          careerId: career.id,
          careerName: career.careerName,
          description: career.description,
          profile,
          jobZone: career.jobZone,
          tags: career.tags || [],
          correlation,
          matchType: getMatchType(correlation),
          matchScore: correlationToMatchScore(correlation),
        };
      })
      .filter((m): m is CareerMatch => m !== null)
      .sort((a, b) => b.correlation - a.correlation)
      .slice(0, topN);

    console.log(`✅ Returning ${fallbackMatches.length} fallback matches`);
    return fallbackMatches;
  }

  // ✅ OPTIMIZATION 4: Sort by correlation (highest first)
  // Time Complexity: O(n log n) where n = matches
  matches.sort((a, b) => b.correlation - a.correlation);

  // Log processing stats
  const endTime = performance.now();
  console.log(`✅ Matched ${matches.length} careers in ${(endTime - startTime).toFixed(2)}ms`);
  if (skippedCount > 0) {
    console.warn(`⚠️ Skipped ${skippedCount} careers due to invalid profiles`);
  }
  if (errors.length > 0 && errors.length <= 5) {
    console.warn('Profile errors:', errors);
  }

  // Return top N
  return matches.slice(0, topN);
}

/**
 * ✅ OPTIMIZED: Calculate statistics with performance tracking
 * Time Complexity: O(n) where n = matches
 */
export function getMatchStatistics(
  matches: CareerMatch[],
  processingTimeMs: number,
  skippedCareers: number = 0,
): MatchStatistics {
  const stats: MatchStatistics = {
    total: matches.length,
    bestFit: matches.filter((m) => m.matchType === MATCH_TYPES.BEST_FIT).length,
    greatFit: matches.filter((m) => m.matchType === MATCH_TYPES.GREAT_FIT).length,
    goodFit: matches.filter((m) => m.matchType === MATCH_TYPES.GOOD_FIT).length,
    avgCorrelation: 0,
    skippedCareers,
    processingTimeMs: Math.round(processingTimeMs * 100) / 100,
  };

  if (matches.length > 0) {
    const sum = matches.reduce((total, m) => total + m.correlation, 0);
    stats.avgCorrelation = Math.round((sum / matches.length) * 1000) / 1000;
  }

  return stats;
}

export function findCareerMatches(
  userScores: RIASECScores,
  careers: CareerFromDB[],
  preferences?: JobPreferences,
  topN: number = DEFAULTS.TOP_MATCHES,
): { matches: CareerMatch[]; statistics: MatchStatistics } {
  const startTime = performance.now();

  // ✅ Single-pass matching with built-in filtering
  const matches = matchCareers(userScores, careers, preferences, topN);

  const endTime = performance.now();
  const processingTime = endTime - startTime;

  // Generate statistics
  const skippedCount = careers.length - matches.length;
  const statistics = getMatchStatistics(matches, processingTime, skippedCount);

  return { matches, statistics };
}

/**
 * ✅ NEW: Batch normalize profiles for better performance
 * Use this to pre-process careers once and cache results
 * Time Complexity: O(n) where n = careers
 */
export function batchNormalizeCareers(
  careers: CareerFromDB[],
): Array<{ career: CareerFromDB; profile: RIASECScores | null }> {
  return careers.map((career) => ({
    career,
    profile: normalizeProfile(career.profile),
  }));
}
