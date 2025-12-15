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
import { Prisma } from '@prisma/client'; // ✅ Add this import

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

  async validate(req: Request): Promise<ClerkUser> {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    if (this.isDevelopment && token === this.devToken) {
      this.logger.debug('🧪 Dev token detected');
      return this.handleDevToken(req);
    }

    if (!this.isDevelopment && token === this.devToken) {
      this.logger.error('❌ Dev token attempted in production mode!');
      throw new UnauthorizedException('Invalid authentication token');
    }

    return this.handleClerkToken(token);
  }

  private async handleDevToken(req: Request): Promise<ClerkUser> {
    if (!this.isDevelopment) {
      throw new UnauthorizedException('Development mode not enabled');
    }

    this.logger.debug('🔓 Processing dev authentication');

    const testUserId = req.headers['x-test-user-id'] as string;

    if (testUserId) {
      if (!testUserId.startsWith('test_') && !testUserId.startsWith('user_')) {
        this.logger.warn(`⚠️  Suspicious test user ID format: ${testUserId}`);
      }

      const dbUser = await this.prisma.user.findUnique({
        where: { clerkId: testUserId },
      });

      if (dbUser) {
        this.logger.debug(`🧪 Using test user: ${dbUser.email} (${dbUser.role})`);
        return this.createMockClerkUser(
          dbUser.clerkId,
          dbUser.email,
          dbUser.firstName,
          dbUser.lastName,
        );
      }

      this.logger.warn(`⚠️  Test user not found: ${testUserId}`);
    }

    const defaultTestUser = await this.getOrCreateDefaultTestUser();
    this.logger.debug(`👤 Using default test user: ${defaultTestUser.email}`);

    return this.createMockClerkUser(
      defaultTestUser.clerkId,
      defaultTestUser.email,
      defaultTestUser.firstName,
      defaultTestUser.lastName,
    );
  }

  private async handleClerkToken(token: string): Promise<ClerkUser> {
    try {
      const tokenPayload = await verifyToken(token, {
        secretKey: this.configService.get('CLERK_SECRET_KEY'),
      });

      if (!tokenPayload || !tokenPayload.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }

      const user = await this.clerkClient.users.getUser(tokenPayload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      this.logger.debug(`✅ User authenticated: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error('Token verification error:', error);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * ✅ FIXED: Get or create default test user with transaction to prevent race condition
   */
  private async getOrCreateDefaultTestUser() {
    const testClerkId = 'test_user_dev_default';
    const testEmail = 'test@careerlykids.dev';

    try {
      // Use transaction to prevent race condition
      return await this.prisma.$transaction(
        async (tx) => {
          // Try to find existing user
          let user = await tx.user.findUnique({
            where: { clerkId: testClerkId },
          });

          if (user) {
            return user;
          }

          // Check if email exists with different clerkId (shouldn't happen, but be safe)
          const emailExists = await tx.user.findUnique({
            where: { email: testEmail },
          });

          if (emailExists) {
            this.logger.warn(
              `Default test email exists with different clerkId: ${emailExists.clerkId}`,
            );
            return emailExists;
          }

          // Create new default test user
          user = await tx.user.create({
            data: {
              clerkId: testClerkId,
              email: testEmail,
              firstName: 'Test',
              lastName: 'User',
              role: 'STUDENT',
              status: 'ACTIVE',
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
      
      // If it's a unique constraint error, try to fetch the existing user
      if (error.code === 'P2002') {
        this.logger.warn('Race condition detected, fetching existing user');
        
        const existingUser = await this.prisma.user.findUnique({
          where: { clerkId: testClerkId },
        });
        
        if (existingUser) {
          return existingUser;
        }

        // Try by email as fallback
        const userByEmail = await this.prisma.user.findUnique({
          where: { email: testEmail },
        });

        if (userByEmail) {
          return userByEmail;
        }
      }

      throw new InternalServerErrorException(
        'Failed to get or create default test user',
      );
    }
  }

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