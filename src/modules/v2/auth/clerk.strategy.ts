import { User as ClerkUser, verifyToken, ClerkClient } from '@clerk/backend';
import {
  Injectable,
  UnauthorizedException,
  Inject,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, AccountStatus } from '@prisma/client';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { extractRoleFromMetadata } from 'src/common/utils/role-metadata.util';

@Injectable()
export class ClerkStrategy extends PassportStrategy(Strategy, 'clerk') {
  private readonly logger = new Logger(ClerkStrategy.name);
  private readonly isDevelopment: boolean;
  private readonly devToken: string;

  constructor(
    @Inject('ClerkClient')
    private readonly clerkClient: ClerkClient,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super();

    const nodeEnv = this.configService.get('NODE_ENV');
    this.isDevelopment = nodeEnv === 'development';

    if (!this.isDevelopment && nodeEnv !== 'production' && nodeEnv !== 'test') {
      throw new InternalServerErrorException(
        `Invalid NODE_ENV: "${nodeEnv}". Must be "development", "production", or "test"`,
      );
    }

    this.devToken = this.configService.get('DEV_AUTH_TOKEN');

    if (this.isDevelopment) {
      if (!this.devToken || this.devToken.length < 12) {
        throw new InternalServerErrorException(
          'DEV_AUTH_TOKEN must be at least 12 characters in development mode',
        );
      }

      this.logger.warn('🔓 DEVELOPMENT MODE ACTIVE');
      this.logger.warn('⚠️  Dev authentication bypass enabled');
      this.logger.warn(`📝 Dev token configured: ${this.devToken.substring(0, 8)}...`);
    } else {
      const clerkSecret = this.configService.get('CLERK_SECRET_KEY');
      if (!clerkSecret || clerkSecret.length < 20) {
        throw new InternalServerErrorException(
          'CLERK_SECRET_KEY not properly configured for production',
        );
      }
      this.logger.log('✅ Production authentication mode active');
    }
  }

  /**
   * Main validation method - returns AuthenticatedUser with both Clerk and DB data
   */
  async validate(req: Request): Promise<AuthenticatedUser> {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // Handle dev token in development mode
    if (this.isDevelopment && token === this.devToken) {
      return this.handleDevToken(req);
    }

    // Prevent dev token usage in production
    if (!this.isDevelopment && token === this.devToken) {
      this.logger.error('❌ Dev token attempted in production mode!');
      throw new UnauthorizedException('Invalid authentication token');
    }

    // Handle real Clerk token
    return this.handleClerkToken(token);
  }

  /**
   * Handle real Clerk JWT token
   * ✅ READ-ONLY: Only reads from DB, never creates
   */
  private async handleClerkToken(token: string): Promise<AuthenticatedUser> {
    try {
      // 1. Verify JWT token
      const tokenPayload = await verifyToken(token, {
        secretKey: this.configService.get('CLERK_SECRET_KEY'),
      });

      if (!tokenPayload || !tokenPayload.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // 2. Get Clerk user
      const clerkUser = await this.clerkClient.users.getUser(tokenPayload.sub);

      if (!clerkUser) {
        throw new UnauthorizedException('User not found in Clerk');
      }

      // ✅ 3. Get database user (READ-ONLY - no creation)
      const dbUser = await this.getDatabaseUser(clerkUser.id);

      // ✅ 4. If user missing, warn but don't fail immediately (async repair tolerance)
      if (!dbUser) {
        this.logger.warn(
          `User ${clerkUser.id} not in database. This may be a webhook delay. User should retry in a moment.`,
        );
        throw new UnauthorizedException(
          'User profile not yet synchronized. Please try again in a moment.',
        );
      }

      this.logger.debug(`✅ User authenticated: ${clerkUser.id} (${dbUser.role})`);

      return {
        ...clerkUser,
        dbUser,
      } as AuthenticatedUser;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('Token verification error:', error);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Handle dev token in development mode
   */
  private async handleDevToken(req: Request): Promise<AuthenticatedUser> {
    if (!this.isDevelopment) {
      throw new UnauthorizedException('Development mode not enabled');
    }

    this.logger.debug('🔓 Processing dev authentication');

    const testUserId = req.headers['x-test-user-id'] as string;

    // If specific test user requested
    if (testUserId) {
      if (!testUserId.startsWith('test_') && !testUserId.startsWith('user_')) {
        this.logger.warn(`⚠️  Suspicious test user ID format: ${testUserId}`);
      }

      const dbUser = await this.prisma.user.findUnique({
        where: { clerkId: testUserId },
        select: {
          id: true,
          clerkId: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          imageUrl: true,
          phoneNumber: true,
          dateOfBirth: true,
          grade: true,
          school: true,
          bio: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
      });

      if (dbUser) {
        this.logger.debug(`🧪 Using test user: ${dbUser.email} (${dbUser.role})`);

        const mockClerkUser = this.createMockClerkUser(
          dbUser.clerkId,
          dbUser.email,
          dbUser.firstName,
          dbUser.lastName,
        );

        return {
          ...mockClerkUser,
          dbUser,
        } as AuthenticatedUser;
      }

      this.logger.warn(`⚠️  Test user not found: ${testUserId}`);
    }

    // Use default test user
    const defaultTestUser = await this.getOrCreateDefaultTestUser();
    this.logger.debug(`👤 Using default test user: ${defaultTestUser.email}`);

    const mockClerkUser = this.createMockClerkUser(
      defaultTestUser.clerkId,
      defaultTestUser.email,
      defaultTestUser.firstName,
      defaultTestUser.lastName,
    );

    return {
      ...mockClerkUser,
      dbUser: defaultTestUser,
    } as AuthenticatedUser;
  }

  /**
   * ✅ READ-ONLY: Get database user without creating
   */
  private async getDatabaseUser(clerkId: string) {
    return await this.prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        imageUrl: true,
        phoneNumber: true,
        dateOfBirth: true,
        grade: true,
        school: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });
  }

  /**
   * Get or create default test user for dev mode
   * ✅ EXCEPTION: Only place where strategy creates users (dev mode only)
   */
  private async getOrCreateDefaultTestUser() {
    const testClerkId = 'test_user_dev_default';
    const testEmail = 'test@careerlykids.dev';

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          let user = await tx.user.findUnique({
            where: { clerkId: testClerkId },
            select: {
              id: true,
              clerkId: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              status: true,
              imageUrl: true,
              phoneNumber: true,
              dateOfBirth: true,
              grade: true,
              school: true,
              bio: true,
              createdAt: true,
              updatedAt: true,
              lastLoginAt: true,
            },
          });

          if (user) {
            return user;
          }

          const emailExists = await tx.user.findUnique({
            where: { email: testEmail },
            select: {
              id: true,
              clerkId: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              status: true,
              imageUrl: true,
              phoneNumber: true,
              dateOfBirth: true,
              grade: true,
              school: true,
              bio: true,
              createdAt: true,
              updatedAt: true,
              lastLoginAt: true,
            },
          });

          if (emailExists) {
            this.logger.warn(
              `Default test email exists with different clerkId: ${emailExists.clerkId}`,
            );
            return emailExists;
          }

          user = await tx.user.create({
            data: {
              clerkId: testClerkId,
              email: testEmail,
              firstName: 'Test',
              lastName: 'User',
              role: 'STUDENT',
              status: 'ACTIVE',
            },
            select: {
              id: true,
              clerkId: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              status: true,
              imageUrl: true,
              phoneNumber: true,
              dateOfBirth: true,
              grade: true,
              school: true,
              bio: true,
              createdAt: true,
              updatedAt: true,
              lastLoginAt: true,
            },
          });

          this.logger.log('✨ Created default test user');
          return user;
        },
        {
          maxWait: 5000,
          timeout: 10000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      this.logger.error('Error creating default test user:', error);

      if (error.code === 'P2002') {
        this.logger.warn('Race condition detected, fetching existing user');

        const existingUser = await this.prisma.user.findUnique({
          where: { clerkId: testClerkId },
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
            imageUrl: true,
            phoneNumber: true,
            dateOfBirth: true,
            grade: true,
            school: true,
            bio: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
          },
        });

        if (existingUser) {
          return existingUser;
        }

        const userByEmail = await this.prisma.user.findUnique({
          where: { email: testEmail },
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
            imageUrl: true,
            phoneNumber: true,
            dateOfBirth: true,
            grade: true,
            school: true,
            bio: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
          },
        });

        if (userByEmail) {
          return userByEmail;
        }
      }

      throw new InternalServerErrorException('Failed to get or create default test user');
    }
  }

  /**
   * Create mock Clerk user for dev mode
   */
  private createMockClerkUser(
    id: string,
    email: string,
    firstName?: string | null,
    lastName?: string | null,
  ): ClerkUser {
    return {
      id,
      emailAddresses: [
        {
          id: 'email_test',
          emailAddress: email,
          verification: { status: 'verified', strategy: 'admin' },
        },
      ] as any,
      firstName: firstName || 'Test',
      lastName: lastName || 'User',
      imageUrl: 'https://via.placeholder.com/150',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as ClerkUser;
  }
}