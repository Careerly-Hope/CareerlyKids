// src/modules/assessments/assessments.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionStatus } from '@prisma/client';
import { scoreTest, validateResponses } from '../scoring/utils/riasec-scoring.util';
import { findCareerMatches } from '../matching/utils/career-matching.util';
import { SubmitTestDto } from './dto/submit-assessment.dto';
import { randomBytes } from 'crypto';
import { AiService } from '../ai/ai.service';
import { FeedBackDto } from './dto/submit-feedback.dto';
import { GetResultDto } from './dto/get-results.dto';
import { AccessTokensService } from '../access-tokens/access-token.service';
import { EmailService } from '../../common/services/email/email.service';

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly accessTokensService: AccessTokensService,
    private readonly emailService: EmailService,
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
      streamRecommendation,
      submittedAt: result.timestamp.toISOString(),
    };
  }

  async getResultWithToken(dto: GetResultDto) {
    this.logger.log(
      `🔑 Result request: ${dto.firstName} ${dto.lastName} (${dto.class}) - Token: ${dto.accessToken}`,
    );
    
    // Step 1: Validate access token
    const tokenValidation = await this.accessTokensService.validateToken(dto.accessToken);
    if (!tokenValidation.valid) {
      throw new BadRequestException({
        message: 'Invalid or expired access token',
        reason: tokenValidation.reason,
      });
    }
    const token = tokenValidation.token!;
    this.logger.log(
      `✅ Token valid: ${token.type} - ${token.school || 'N/A'} (${token.usageCount}/${token.maxUsage})`,
    );
    
    // Step 2: Fetch test result
    const result = await this.prisma.testResult.findUnique({
      where: { sessionToken: dto.sessionToken },
      select: {
        id: true,
        careerCode: true,
        scores: true,
        totalScore: true,
        tier: true,
        matchedCareers: true,
        timestamp: true,
        aiRecommendation: true,
      },
    });
    
    if (!result) {
      throw new NotFoundException('Test result not found for this session');
    }
    
    // Step 3: Check if this token has already unlocked this result
    const existingUsage = await this.prisma.tokenUsage.findUnique({
      where: {
        unique_token_session: {
          tokenId: token.id,
          sessionToken: dto.sessionToken,
        },
      },
    });
    
    let isReview = false;
    let viewCount = 1;
    let unlockedAt = new Date();
    
    if (existingUsage) {
      // Already unlocked - this is a REVIEW
      isReview = true;
      viewCount = existingUsage.viewCount + 1;
      unlockedAt = existingUsage.unlockedAt;
      this.logger.log(
        `♻️ Review access: Already unlocked on ${unlockedAt.toISOString()} (view #${viewCount})`,
      );
      
      // Update view count and lastViewedAt (does NOT increment usageCount)
      await this.prisma.tokenUsage.update({
        where: { id: existingUsage.id },
        data: {
          viewCount: viewCount,
          lastViewedAt: new Date(),
          ...(dto.parentEmail && { parentEmail: dto.parentEmail }), // Update if provided
        },
      });
    } else {
      // First time unlocking - CREATE NEW USAGE (this WILL increment usageCount)
      this.logger.log(`🆕 New unlock: Creating TokenUsage record`);
      await this.prisma.$transaction(async (tx) => {
        // Create usage record
        await tx.tokenUsage.create({
          data: {
            tokenId: token.id,
            sessionToken: dto.sessionToken,
            firstName: dto.firstName,
            lastName: dto.lastName,
            class: dto.class,
            ...(dto.parentEmail && { parentEmail: dto.parentEmail }), // Only include if provided
            viewCount: 1,
            unlockedAt: new Date(),
            lastViewedAt: new Date(),
          },
        });
        
        // Increment token usage count (ONLY for new unlocks)
        await this.accessTokensService.markTokenUsed(dto.accessToken);
      });
      
      this.logger.log(
        `✅ Result unlocked: ${dto.firstName} ${dto.lastName} (${dto.class}) → ${result.id}`,
      );
      
      // Step 4: Send results email to parent (only on first unlock AND if email provided)
      if (dto.parentEmail) {
        try {
          const matches = result.matchedCareers as any[];
          const aiRecommendation = result.aiRecommendation as any;
          
          await this.emailService.sendResults({
            parentEmail: dto.parentEmail,
            studentName: `${dto.firstName} ${dto.lastName}`,
            studentClass: dto.class,
            school: token.school || undefined,
            careerCode: result.careerCode,
            scores: result.scores as Record<string, number>,
            totalScore: result.totalScore,
            tier: result.tier || 'N/A',
            matches: matches.map(m => ({
              careerName: m.careerName,
              description: m.description,
              matchScore: m.matchScore,
              tags: m.tags || [],
              jobZone: m.jobZone || 3,
            })),
            streamRecommendation: {
              recommendedStream: aiRecommendation?.recommendedStream || 'N/A',
              reasoning: aiRecommendation?.reasoning || 'No reasoning available',
              streamAlignment: aiRecommendation?.streamAlignment || {
                science: 0,
                commercial: 0,
                art: 0,
              },
            },
          });
          
          this.logger.log(`📧 Results email sent to ${dto.parentEmail}`);
        } catch (emailError) {
          // Log error but don't fail the request
          this.logger.error(`Failed to send results email: ${emailError.message}`);
        }
      } else {
        this.logger.log(`ℹ️ No parent email provided - skipping results email`);
      }
    }
    
    // Step 5: Return result with student info and access metadata
    return {
      // Student info
      firstName: dto.firstName,
      lastName: dto.lastName,
      class: dto.class,
      // Test results
      resultId: result.id,
      careerCode: result.careerCode,
      scores: result.scores as Record<string, number>,
      totalScore: result.totalScore,
      tier: result.tier,
      matches: result.matchedCareers,
      streamRecommendation: result.aiRecommendation,
      submittedAt: result.timestamp.toISOString(),
      // Access info
      accessInfo: {
        tokenType: token.type,
        school: token.school,
        isReview: isReview,
        unlockedAt: unlockedAt.toISOString(),
        viewCount: viewCount,
        remainingUsage: token.maxUsage - (isReview ? token.usageCount : token.usageCount + 1),
        expiresAt: token.expiresAt.toISOString(),
      },
    };
  }

  /**
   * Get detailed usage report for a specific token
   * Shows all students who have unlocked results with this token
   */
  async getTokenUsageReport(tokenString: string) {
    const token = await this.prisma.accessToken.findUnique({
      where: { token: tokenString },
      include: {
        usages: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            class: true,
            sessionToken: true,
            parentEmail: true,
            unlockedAt: true,
            lastViewedAt: true,
            viewCount: true,
          },
          orderBy: { unlockedAt: 'desc' },
        },
      },
    });

    if (!token) {
      throw new NotFoundException('Token not found');
    }

    return {
      // Token info
      token: token.token,
      school: token.school,
      type: token.type,
      status: token.status,

      // Usage stats
      usageCount: token.usageCount,
      maxUsage: token.maxUsage,
      remainingUsage: token.maxUsage - token.usageCount,

      // Validity
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      firstUsedAt: token.firstUsedAt,

      // Student list
      totalStudents: token.usages.length,
      totalViews: token.usages.reduce((sum, u) => sum + u.viewCount, 0),
      students: token.usages.map((usage) => ({
        name: `${usage.firstName} ${usage.lastName}`,
        class: usage.class,
        parentEmail: usage.parentEmail,
        sessionToken: usage.sessionToken,
        unlockedAt: usage.unlockedAt,
        lastViewedAt: usage.lastViewedAt,
        viewCount: usage.viewCount,
      })),
    };
  }

  /**
   * Get usage analytics by class
   * Helps schools see which classes are using tokens
   */
  async getUsageByClass(tokenString: string) {
    const token = await this.prisma.accessToken.findUnique({
      where: { token: tokenString },
    });

    if (!token) {
      throw new NotFoundException('Token not found');
    }

    const usageByClass = await this.prisma.tokenUsage.groupBy({
      by: ['class'],
      where: { tokenId: token.id },
      _count: {
        id: true,
      },
      _sum: {
        viewCount: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    return {
      token: token.token,
      school: token.school,
      classes: usageByClass.map((item) => ({
        class: item.class,
        studentsUnlocked: item._count.id,
        totalViews: item._sum.viewCount || 0,
      })),
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

  async submitFeedback(dto: FeedBackDto) {
    const result = await this.prisma.testResult.findUnique({
      where: { sessionToken: dto.sessionToken },
    });

    if (!result) {
      throw new NotFoundException('Test result not found');
    }

    await this.prisma.testResult.update({
      where: { id: result.id },
      data: {
        userFeedback: dto.feedback,
        feedbackRating: dto.rating,
        feedbackSubmittedAt: new Date(),
      },
    });

    this.logger.log(`✅ Feedback submitted for result ${result.id} - Rating: ${dto.rating}`);

    return {
      success: true,
      message: 'Feedback submitted successfully',
      resultId: result.id,
      rating: dto.rating,
    };
  }
}