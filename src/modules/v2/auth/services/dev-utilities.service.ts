import { Injectable, Logger, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { ClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';
import { UserRole } from '../../../../common/enums/user-role.enum';
import { UserRole as PrismaUserRole, AccountStatus } from '@prisma/client';

/**
 * 🛠️ Dev Utilities Service
 *
 * Development-only utilities:
 * - Generate test tokens for API testing
 * - Create super admin accounts
 *
 * All methods validate development mode before executing.
 */
@Injectable()
export class DevUtilitiesService {
  private readonly logger = new Logger(DevUtilitiesService.name);
  private readonly isDevelopment: boolean;

  constructor(
    @Inject('ClerkClient') private readonly clerkClient: ClerkClient,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.isDevelopment = this.configService.get('NODE_ENV') === 'development';
  }

  /**
   * Generate test token for API testing (DEV ONLY)
   */
  async generateTestToken(email: string, templateName: string = 'api-testing') {
    this.validateDevMode();

    try {
      const users = await this.clerkClient.users.getUserList({ emailAddress: [email] });

      if (!users.data || users.data.length === 0) {
        throw new NotFoundException(`User with email ${email} not found in Clerk`);
      }

      const clerkUser = users.data[0];

      const sessionsList = await this.clerkClient.sessions.getSessionList({
        userId: clerkUser.id,
        status: 'active',
      });

      let sessionId: string;

      if (sessionsList.data && sessionsList.data.length > 0) {
        sessionId = sessionsList.data[0].id;
      } else {
        const session = await this.clerkClient.sessions.createSession({
          userId: clerkUser.id,
        });
        sessionId = session.id;
      }

      const tokenResponse = await this.clerkClient.sessions.getToken(sessionId, templateName);

      return {
        message: 'Token generated successfully',
        user: {
          clerkId: clerkUser.id,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          role: (clerkUser.publicMetadata as any)?.role || 'STUDENT',
        },
        token: tokenResponse.jwt,
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
        howToUse: {
          swagger: 'Click "Authorize" button and paste this token',
          postman: 'Add header: Authorization: Bearer <token>',
        },
      };
    } catch (error) {
      this.logger.error('Error generating test token:', error);
      throw new BadRequestException(`Failed to generate token: ${error.message}`);
    }
  }

  /**
   * Create super admin (DEV ONLY)
   */
  async createSuperAdmin(email: string, password: string, firstName: string, lastName: string) {
    this.validateDevMode();

    try {
      // Create in Clerk with SUPER_ADMIN in private metadata
      const clerkUser = await this.clerkClient.users.createUser({
        emailAddress: [email],
        password,
        firstName,
        lastName,
        privateMetadata: {
          role: UserRole.SUPER_ADMIN,
          createdBy: 'system',
          adminLevel: 'full',
        },
        publicMetadata: {
          role: UserRole.SUPER_ADMIN,
        },
      });

      // Create in database
      const user = await this.prisma.user.create({
        data: {
          clerkId: clerkUser.id,
          email,
          firstName,
          lastName,
          imageUrl: clerkUser.imageUrl,
          role: UserRole.SUPER_ADMIN as PrismaUserRole,
          status: AccountStatus.ACTIVE,
          lastLoginAt: new Date(),
        },
      });

      this.logger.log(`✅ Super admin created: ${email}`);

      return {
        message: 'Super admin created successfully',
        user: {
          clerkId: user.clerkId,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      this.logger.error('Error creating super admin:', error);
      throw new BadRequestException(`Failed to create super admin: ${error.message}`);
    }
  }

  private validateDevMode(): void {
    if (!this.isDevelopment) {
      throw new BadRequestException('This endpoint is only available in development mode');
    }
  }
}
