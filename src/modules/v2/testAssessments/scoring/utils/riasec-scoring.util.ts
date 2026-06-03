import { Question } from '@prisma/client';
import { TIER_THRESHOLDS, TIER_NAMES, SCORE_CONSTRAINTS } from '../constants/scoring.constants';

export interface RIASECScores {
  R: number;
  I: number;
  A: number;
  S: number;
  E: number;
  C: number;
}

export interface QuestionResponse {
  questionId: number;
  score: number;
}

export interface ScoringResult {
  scores: RIASECScores;
  careerCode: string;
  topThree: Array<{ category: string; score: number }>;
  totalScore: number;
  tier: string;
}

// Custom error class for better error handling
export class ScoringError extends Error {
  constructor(
    message: string,
    public errors: string[],
  ) {
    super(message);
    this.name = 'ScoringError';
  }
}

export function calculateRIASECScores(
  responses: QuestionResponse[],
  questions: Question[],
): RIASECScores {
  const scores: RIASECScores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  const errors: string[] = [];

  // ✅ CREATE LOOKUP MAP ONCE - Like creating an index in a book
  // Instead of searching through all questions for each response,
  // we create a "dictionary" where we can instantly find any question
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // ✅ NOW EACH LOOKUP IS INSTANT
  responses.forEach((response) => {
    const question = questionMap.get(response.questionId);

    // ✅ COLLECT ERRORS instead of just logging them
    if (!question) {
      errors.push(`Question ${response.questionId} not found`);
      return;
    }

    const { category } = question;
    const { score } = response;

    // ✅ VALIDATE SCORE using constants (no magic numbers!)
    if (score < SCORE_CONSTRAINTS.MIN_SCORE || score > SCORE_CONSTRAINTS.MAX_SCORE) {
      errors.push(
        `Invalid score ${score} for question ${response.questionId} ` +
          `(must be between ${SCORE_CONSTRAINTS.MIN_SCORE} and ${SCORE_CONSTRAINTS.MAX_SCORE})`,
      );
      return;
    }

    scores[category] += score;
  });

  // ✅ THROW ERROR if problems found - Don't hide issues from the user!
  if (errors.length > 0) {
    throw new ScoringError('Invalid assessment responses', errors);
  }

  return scores;
}

/**
 * Generate 3-letter career code from RIASEC scores
 * Example: { R: 50, I: 45, A: 40, ... } → "RIA"
 */
export function generateCareerCode(scores: RIASECScores): string {
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]) // Sort by score (highest first)
    .slice(0, 3); // Take top 3
  return sorted.map((entry) => entry[0]).join('');
}

/**
 * Determine tier based on total score
 *
 * IMPROVEMENT: Uses constants instead of magic numbers
 * Now if thresholds change, you only update ONE file!
 */
export function calculateTier(totalScore: number): string {
  if (totalScore >= TIER_THRESHOLDS.LEADER) return TIER_NAMES.LEADER;
  if (totalScore >= TIER_THRESHOLDS.INNOVATOR) return TIER_NAMES.INNOVATOR;
  if (totalScore >= TIER_THRESHOLDS.APPRENTICE) return TIER_NAMES.APPRENTICE;
  return TIER_NAMES.EXPLORER;
}

/**
 * Complete scoring function
 *
 * IMPROVEMENTS:
 * 1. Uses constants for validation (SCORE_CONSTRAINTS.TOTAL_QUESTIONS)
 * 2. Better error messages
 * 3. All errors bubble up properly
 */
export function scoreTest(responses: QuestionResponse[], questions: Question[]): ScoringResult {
  // Validate input
  if (!responses || !Array.isArray(responses)) {
    throw new Error('Responses must be an array');
  }
  if (!questions || !Array.isArray(questions)) {
    throw new Error('Questions must be an array');
  }
  if (responses.length !== SCORE_CONSTRAINTS.TOTAL_QUESTIONS) {
    throw new Error(
      `Expected ${SCORE_CONSTRAINTS.TOTAL_QUESTIONS} responses, got ${responses.length}`,
    );
  }

  // Calculate scores (this now throws proper errors)
  const scores = calculateRIASECScores(responses, questions);

  // Calculate total score
  const totalScore = Object.values(scores).reduce((sum, val) => sum + val, 0);

  // Generate career code
  const careerCode = generateCareerCode(scores);

  // Calculate tier
  const tier = calculateTier(totalScore);

  // Get top three
  const topThree = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, score]) => ({ category: cat, score }));

  return {
    scores,
    careerCode,
    topThree,
    totalScore,
    tier,
  };
}

/**
 * Validate test responses
 *
 * IMPROVEMENT: Uses constants for validation values
 */
/**
 * Validate test responses with duplicate detection
 */
export function validateResponses(responses: QuestionResponse[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(responses)) {
    return { valid: false, errors: ['Responses must be an array'] };
  }

  if (responses.length !== SCORE_CONSTRAINTS.TOTAL_QUESTIONS) {
    errors.push(`Expected ${SCORE_CONSTRAINTS.TOTAL_QUESTIONS} responses, got ${responses.length}`);
  }

  // ✅ CHECK FOR DUPLICATE QUESTION IDs
  const questionIds = new Set<number>();
  const duplicates: number[] = [];

  responses.forEach((response, idx) => {
    if (!response.questionId) {
      errors.push(`Response ${idx}: missing questionId`);
      return;
    }

    // Track duplicates
    if (questionIds.has(response.questionId)) {
      duplicates.push(response.questionId);
    }
    questionIds.add(response.questionId);

    if (response.score === undefined || response.score === null) {
      errors.push(`Response ${idx}: missing score`);
    }
    if (
      response.score < SCORE_CONSTRAINTS.MIN_SCORE ||
      response.score > SCORE_CONSTRAINTS.MAX_SCORE
    ) {
      errors.push(
        `Response ${idx}: invalid score ${response.score} ` +
          `(must be ${SCORE_CONSTRAINTS.MIN_SCORE}-${SCORE_CONSTRAINTS.MAX_SCORE})`,
      );
    }
  });

  // ✅ ADD CLEAR ERROR MESSAGE FOR DUPLICATES
  if (duplicates.length > 0) {
    const uniqueDuplicates = [...new Set(duplicates)];
    errors.push(
      `Duplicate question IDs detected: ${uniqueDuplicates.join(', ')}. ` +
        `Each question must be answered exactly once.`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
