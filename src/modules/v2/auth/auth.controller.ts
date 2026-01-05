import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { ApiResponse } from 'src/common/dto/response.dto';
import { Webhook } from 'svix';
import { ConfigService } from '@nestjs/config';
import { ClerkWebhookEvent } from './dto/clerk-webhook.dto';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { SkipThrottle } from '@nestjs/throttler';
import { RequestContext, RequestMetadata } from 'src/common/decorators/request-metadata.decorator';

@ApiTags('v2/Auth')
@Controller('v2/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('test-timeout')
  @Public()
  async testTimeout() {
    await new Promise((resolve) => setTimeout(resolve, 60000));
    return { ok: true };
  }

  // ============================================
  // WEBHOOK ENDPOINT
  // ============================================

  @Post('webhook/clerk')
  @Public()
  @SkipThrottle() // ✅ Skip global rate limiting
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔓 Handle Clerk webhooks',
    description: `
      Receives webhooks from Clerk for automatic user synchronization.
      
      **Events:**
      - user.created: Creates user in database
      - user.updated: Updates user in database
      - user.deleted: Deletes user from database
      
      **Security:** Verified using Clerk webhook secret (svix)
    `,
  })
  @SwaggerResponse({ status: 200, description: 'Webhook processed successfully' })
  @SwaggerResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleWebhook(
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const payload = req.body;

    if (!svixId || !svixTimestamp || !svixSignature) {
      this.logger.warn('Missing svix headers in webhook request');
      throw new BadRequestException('Missing svix headers');
    }

    // Verify webhook signature
    const webhookSecret = this.configService.get('CLERK_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.error('Webhook secret not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    const wh = new Webhook(webhookSecret);
    let event: ClerkWebhookEvent;

    try {
      event = wh.verify(JSON.stringify(payload), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent;
    } catch (error) {
      this.logger.error('Invalid webhook signature', error);
      throw new BadRequestException('Invalid webhook signature');
    }

    // ✅ Extract event ID for idempotency
    const eventId = svixId; // Svix ID is unique per event

    try {
      // ✅ Handle different event types with idempotency
      switch (event.type) {
        case 'user.created':
          await this.authService.handleUserCreated(event, eventId);
          break;

        case 'user.updated':
          await this.authService.handleUserUpdated(event, eventId);
          break;

        case 'user.deleted':
          await this.authService.handleUserDeleted(event, eventId);
          break;

        default:
          this.logger.warn(`Unhandled webhook event type: ${event.type}`);
      }

      return { success: true };
    } catch (error) {
      // ✅ Enhanced error handling
      this.logger.error(`Webhook processing error for event ${eventId}:`, error);

      // Known errors - return 200 so Clerk doesn't retry
      if (error.code === 'P2002' || error.code === 'P2025') {
        this.logger.warn('Known database error, returning success to prevent retry');
        return { success: true, note: 'Duplicate or not found, ignored' };
      }

      // Unknown errors - return 500 so Clerk retries
      throw error;
    }
  }

  // ============================================
  // USER PROFILE ENDPOINTS
  // ============================================

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '🟡 Get current user profile',
    description: "Returns the authenticated user's profile.",
  })
  @SwaggerResponse({ status: 200, description: 'Returns user profile.' })
  @SwaggerResponse({ status: 401, description: 'Unauthorized.' })
  @SwaggerResponse({ status: 404, description: 'User not found.' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return ApiResponse.success(user.dbUser, 'User profile retrieved');
  }

  @Patch('profile')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '🟢 Update user profile',
    description: "Updates the authenticated user's profile in both database and Clerk.",
  })
  @ApiBody({
    description: 'Fields to update in user profile',
    type: UpdateProfileDto,
  })
  @SwaggerResponse({ status: 200, description: 'Profile updated successfully.' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser['dbUser'],
    @Body() dto: UpdateProfileDto,
    @RequestContext() context: RequestMetadata,
  ) {
    // ✅ Three-layer identity model:
    // - user.clerkId = Clerk's ID (stored in DB, used for Clerk API calls)
    // - user.id = Database UUID (used for foreign keys)
    // - context = Request metadata (created once by middleware)
    
    const updated = await this.authService.updateProfile(
      user.clerkId,        // ✅ Clerk ID from database
      dto,
      user.id,             // ✅ Database UUID
      context.requestId,   // ✅ From middleware (single source of truth)
      context.ipAddress,   // ✅ From Express with trust proxy
    );
    
    return ApiResponse.success(updated, 'Profile updated successfully');
  }

  @Delete('account')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '🟢 Delete user account',
    description: 'Deletes user account from both Clerk and database.',
  })
  @SwaggerResponse({ status: 200, description: 'Account deleted successfully.' })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser['dbUser'],
    @RequestContext() context: RequestMetadata,
  ) {
    const result = await this.authService.deleteAccount(
      user.clerkId,       
      user.id,            
      context.requestId,  
      context.ipAddress,  
    );
    
    return ApiResponse.success(result, 'Account deleted successfully');
  }

  // ============================================
  // DEV/TEST ENDPOINTS
  // ============================================

  @Post('dev/generate-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🧪 [DEV ONLY] Generate JWT token for testing',
    description: `
      Generates a long-lived JWT token (10 years) for API testing in Swagger/Postman.
      
      **Prerequisites:**
      1. User must exist in Clerk
      2. JWT template must be created in Clerk Dashboard
      
      **Steps:**
      1. Create users in Clerk Dashboard
      2. Create JWT template named "swagger-testing" with 10-year lifetime
      3. Call this endpoint with user email
      4. Copy token and use in Swagger "Authorize" button
      
      **⚠️ DEV MODE ONLY** - This endpoint only works in development environment.
    `,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: {
          type: 'string',
          example: 'student@careerlykids.dev',
          description: 'Email of the Clerk user',
        },
        templateName: {
          type: 'string',
          example: 'api-testing',
          default: 'api-testing',
          description: 'Name of the JWT template in Clerk Dashboard',
        },
      },
    },
  })
  @SwaggerResponse({
    status: 200,
    description: 'Token generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Token generated successfully' },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                clerkId: { type: 'string' },
                email: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                role: { type: 'string' },
              },
            },
            token: {
              type: 'string',
              description: 'JWT token - copy this to Swagger Authorize button',
            },
            expiresAt: { type: 'string', format: 'date-time' },
            howToUse: {
              type: 'object',
              properties: {
                swagger: { type: 'string' },
                postman: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  @SwaggerResponse({ status: 400, description: 'Bad request - user not found or template missing' })
  @SwaggerResponse({ status: 403, description: 'Not available in production' })
  async generateTestToken(@Body() body: { email: string; templateName?: string }) {
    const result = await this.authService.generateTestToken(
      body.email,
      body.templateName || 'api-testing',
    );
    return ApiResponse.success(result, 'Test token generated');
  }

  @Post('dev/create-super-admin')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '🧪 [DEV ONLY] Create super admin user',
    description: `
      Creates a super admin user with full system access.
      
      **What it does:**
      - Creates user in Clerk with SUPER_ADMIN role in private metadata
      - Creates user in database with SUPER_ADMIN role
      - Sets account status to ACTIVE
      
      **⚠️ DEV MODE ONLY** - This endpoint only works in development environment.
    `,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password', 'firstName', 'lastName'],
      properties: {
        email: {
          type: 'string',
          format: 'email',
          example: 'admin@careerlykids.dev',
          description: 'Admin email address',
        },
        password: {
          type: 'string',
          minLength: 8,
          example: 'Admin123!@#',
          description: 'Strong password (min 8 characters)',
        },
        firstName: {
          type: 'string',
          example: 'John',
          description: 'Admin first name',
        },
        lastName: {
          type: 'string',
          example: 'Doe',
          description: 'Admin last name',
        },
      },
    },
  })
  @SwaggerResponse({
    status: 201,
    description: 'Super admin created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Super admin created successfully' },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                clerkId: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string', example: 'SUPER_ADMIN' },
              },
            },
          },
        },
      },
    },
  })
  @SwaggerResponse({ status: 400, description: 'Bad request - validation failed' })
  @SwaggerResponse({ status: 403, description: 'Not available in production' })
  @SwaggerResponse({ status: 409, description: 'User already exists' })
  async createSuperAdmin(
    @Body() body: { email: string; password: string; firstName: string; lastName: string },
  ) {
    const result = await this.authService.createSuperAdmin(
      body.email,
      body.password,
      body.firstName,
      body.lastName,
    );
    return ApiResponse.success(result, 'Super admin created successfully');
  }
}
