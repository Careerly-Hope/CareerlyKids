import { verifyToken, ClerkClient } from '@clerk/backend';
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
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';

@Injectable()
export class ClerkStrategy extends PassportStrategy(Strategy, 'clerk') {
  private readonly logger = new Logger(ClerkStrategy.name);

  constructor(
    @Inject('ClerkClient')
    private readonly clerkClient: ClerkClient,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super();

    const clerkSecret = this.configService.get('CLERK_SECRET_KEY');
    if (!clerkSecret || clerkSecret.length < 20) {
      throw new InternalServerErrorException('CLERK_SECRET_KEY not properly configured');
    }
    this.logger.log('✅ Clerk authentication initialized');
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

    return this.handleClerkToken(token);
  }

  /**
   * Handle Clerk JWT token
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

      // 3. Get database user (READ-ONLY - no creation)
      const dbUser = await this.getDatabaseUser(clerkUser.id);

      // 4. If user missing, warn but don't fail immediately (async repair tolerance)
      if (!dbUser) {
        this.logger.warn(
          `User ${clerkUser.id} not in database. This may be a webhook delay. User should retry in a moment.`,
        );
        throw new UnauthorizedException(
          'User profile not yet synchronized. Please try again in a moment.',
        );
      }

      this.logger.debug(`✅ User authenticated: ${clerkUser.id} (${dbUser.role})`);

      const authenticatedUser = clerkUser as any;
      authenticatedUser.dbUser = dbUser;
      return authenticatedUser as AuthenticatedUser;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Token verification error:', error);
      throw new UnauthorizedException('Invalid or expired token');
    }
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
}
