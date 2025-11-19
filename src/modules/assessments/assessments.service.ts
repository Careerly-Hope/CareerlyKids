// src/modules/assessments/assessments.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionStatus } from '@prisma/client';
import { scoreTest, validateResponses } from '../scoring/utils/riasec-scoring.util';
import { findCareerMatches } from '../matching/utils/career-matching.util';
import { SubmitTestDto } from './dto/submit-assessment.dto';
import { randomBytes } from 'crypto';
import { AiService } from '../ai/ai.service';

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async startTest() {
    const startTime = Date.now();

    try {
      // First check: Count active questions
      const activeCount = await this.prisma.question.count({
        where: { isActive: true },
      });

      this.logger.log(`📊 Active questions in DB: ${activeCount}`);

      if (activeCount < 60) {
        const totalCount = await this.prisma.question.count();
        throw new BadRequestException(
          `Not enough active questions. Found ${activeCount} active out of ${totalCount} total. Need 60.`,
        );
      }

      // Fetch ALL active questions (Prisma ORM - more reliable)
      const allQuestions = await this.prisma.question.findMany({
        where: { isActive: true },
        select: {
          id: true,
          text: true,
          category: true,
        },
      });

      this.logger.log(`✅ Fetched ${allQuestions.length} questions via Prisma ORM`);

      // Shuffle using Fisher-Yates algorithm
      const shuffled = this.shuffleArray([...allQuestions]);
      const questions = shuffled.slice(0, 60);

      // Create session
      const session = await this.prisma.testSession.create({
        data: {
          sessionToken: this.generateSessionToken(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: SessionStatus.STARTED,
        },
      });

      this.logger.log(`🎉 Session ${session.sessionToken} started in ${Date.now() - startTime}ms`);

      return {
        sessionToken: session.sessionToken,
        expiresAt: session.expiresAt.toISOString(),
        questions,
      };
    } catch (error) {
      this.logger.error('❌ Error in startTest:', error);
      throw error;
    }
  }

  /**
   * Fisher-Yates shuffle for randomizing questions
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private generateSessionToken(): string {
    return randomBytes(32).toString('hex');
  }

  async submitTest(dto: SubmitTestDto) {
    const startTime = Date.now();

    // ✅ VALIDATE EARLY - Before any DB calls
    const validation = validateResponses(dto.responses);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Invalid responses',
        errors: validation.errors,
      });
    }

    // ✅ PARALLEL QUERIES - Fetch session and questions simultaneously
    const questionIds = dto.responses.map((r) => r.questionId);
    const [session, questions] = await Promise.all([
      this.prisma.testSession.findUnique({
        where: { sessionToken: dto.sessionToken },
      }),
      this.prisma.question.findMany({
        where: {
          id: { in: questionIds },
          isActive: true,
        },
      }),
    ]);

    // Validate session
    if (!session) {
      throw new NotFoundException('Invalid session token');
    }
    if (session.status === SessionStatus.COMPLETED) {
      throw new BadRequestException('Test already completed');
    }
    if (session.expiresAt < new Date()) {
      throw new BadRequestException('Session expired');
    }

    // ✅ BETTER ERROR MESSAGE for missing/invalid questions
    if (questions.length !== 60) {
      const foundIds = new Set(questions.map((q) => q.id));
      const missingIds = questionIds.filter((id) => !foundIds.has(id));

      throw new BadRequestException(
        `Invalid or inactive questions: ${missingIds.slice(0, 5).join(', ')}${
          missingIds.length > 5 ? ` and ${missingIds.length - 5} more` : ''
        }`,
      );
    }

    // Calculate scores
    const scoringResult = scoreTest(dto.responses, questions);

    // Fetch active careers
    const careers = await this.prisma.careerProfile.findMany({
      where: { isActive: true },
      select: {
        id: true,
        careerName: true,
        description: true,
        profile: true,
        jobZone: true,
        tags: true,
      },
    });

    this.logger.debug('First career profile:', careers[0]?.profile);
    this.logger.debug('User scores:', scoringResult.scores);

    // Match careers
    const { matches, statistics } = findCareerMatches(
      scoringResult.scores,
      careers,
      dto.jobPreferences,
      10,
    );

    // ✅ NEW: Generate AI stream recommendation
    this.logger.log('🤖 Generating AI stream recommendation...');
    const streamRecommendation = await this.aiService.generateStreamRecommendation({
      careerCode: scoringResult.careerCode,
      scores: scoringResult.scores,
      topMatches: matches.slice(0, 3).map((m) => ({
        careerName: m.careerName,
        tags: m.tags,
      })),
      tier: scoringResult.tier,
    });
    this.logger.log(`✅ AI recommended: ${streamRecommendation.recommendedStream}`);

    // ✅ SAVE RESULT with proper type casting and AI recommendation
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.testSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.COMPLETED },
      });

      return tx.testResult.create({
        data: {
          sessionToken: dto.sessionToken,
          responses: dto.responses as any,
          scores: scoringResult.scores as any,
          careerCode: scoringResult.careerCode,
          matchedCareers: matches as any,
          jobPreferences: dto.jobPreferences || null,
          tier: scoringResult.tier,
          totalScore: scoringResult.totalScore,
          completionTime: Math.floor((Date.now() - startTime) / 1000),
          // Store AI recommendation in a JSON field (you may need to add this to your Prisma schema)
          aiRecommendation: streamRecommendation as any,
        },
      });
    });

    this.logger.log(`Test ${result.id} completed in ${Date.now() - startTime}ms`);

    return {
      resultId: result.id,
      careerCode: scoringResult.careerCode,
      scores: scoringResult.scores,
      totalScore: scoringResult.totalScore,
      tier: scoringResult.tier,
      matches,
      statistics,
      streamRecommendation, // ✅ NEW: Include AI recommendation in response
      submittedAt: result.timestamp.toISOString(),
    };
  }

  async getResult(sessionToken: string) {
    const result = await this.prisma.testResult.findUnique({
      where: { sessionToken },
      select: {
        id: true,
        careerCode: true,
        scores: true,
        totalScore: true,
        tier: true,
        matchedCareers: true,
        timestamp: true,
        aiRecommendation: true, // ✅ NEW: Include AI recommendation
      },
    });

    if (!result) {
      throw new NotFoundException('Result not found');
    }

    return {
      resultId: result.id,
      careerCode: result.careerCode,
      scores: result.scores,
      totalScore: result.totalScore,
      tier: result.tier,
      matches: result.matchedCareers,
      streamRecommendation: result.aiRecommendation, // ✅ NEW: Include in response
      submittedAt: result.timestamp.toISOString(),
    };
  }

  async getStatistics() {
    const stats = await this.prisma.$queryRaw<
      Array<{
        total_tests: bigint;
        avg_r: number | null;
        avg_i: number | null;
        avg_a: number | null;
        avg_s: number | null;
        avg_e: number | null;
        avg_c: number | null;
      }>
    >`
        SELECT 
          COUNT(*) as total_tests,
          AVG((scores->>'R')::numeric) as avg_r,
          AVG((scores->>'I')::numeric) as avg_i,
          AVG((scores->>'A')::numeric) as avg_a,
          AVG((scores->>'S')::numeric) as avg_s,
          AVG((scores->>'E')::numeric) as avg_e,
          AVG((scores->>'C')::numeric) as avg_c
        FROM test_results
      `;

    const topCodes = await this.prisma.$queryRaw<Array<{ career_code: string; count: bigint }>>`
        SELECT career_code, COUNT(*) as count
        FROM test_results
        GROUP BY career_code
        ORDER BY count DESC
        LIMIT 10
      `;

    const tierDist = await this.prisma.$queryRaw<Array<{ tier: string; count: bigint }>>`
        SELECT tier, COUNT(*) as count
        FROM test_results
        WHERE tier IS NOT NULL
        GROUP BY tier
        ORDER BY count DESC
      `;

    // ✅ SAFE ACCESS with default values
    const firstRow = stats[0];

    return {
      totalTests: Number(firstRow?.total_tests ?? 0),
      topCareerCodes: topCodes.map((c) => c.career_code),
      averageScores: {
        R: Math.round(Number(firstRow?.avg_r ?? 0) * 10) / 10,
        I: Math.round(Number(firstRow?.avg_i ?? 0) * 10) / 10,
        A: Math.round(Number(firstRow?.avg_a ?? 0) * 10) / 10,
        S: Math.round(Number(firstRow?.avg_s ?? 0) * 10) / 10,
        E: Math.round(Number(firstRow?.avg_e ?? 0) * 10) / 10,
        C: Math.round(Number(firstRow?.avg_c ?? 0) * 10) / 10,
      },
      tierDistribution: tierDist.reduce(
        (acc, t) => {
          acc[t.tier] = Number(t.count);
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.testSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        status: { not: SessionStatus.COMPLETED },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired sessions`);
    return result.count;
  }
}
