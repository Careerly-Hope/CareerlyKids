// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Get the database user ID (UUID) - USE THIS for foreign keys in services
 * 
 * @example
 * ```typescript
 * @Post('purchase')
 * async purchaseToken(
 *   @CurrentUserId() userId: string,
 *   @Body() dto: PurchaseDto,
 * ) {
 *   // userId is the database UUID
 *   return this.service.purchase(dto, userId);
 * }
 * ```
 */
export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    
    if (!user?.dbUser?.id) {
      throw new Error('User not authenticated or dbUser.id not found');
    }
    
    return user.dbUser.id;
  },
);

/**
 * Get the database user object (without Clerk data)
 * 
 * @example
 * ```typescript
 * @Get('profile')
 * async getProfile(@CurrentUser() user: AuthenticatedUser['dbUser']) {
 *   const { id, email, role, firstName, lastName } = user;
 *   return { id, email, role, fullName: `${firstName} ${lastName}` };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser['dbUser'] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    
    if (!user?.dbUser) {
      throw new Error('User not authenticated or dbUser not found');
    }
    
    return user.dbUser;
  },
);

/**
 * Get the full authenticated user (Clerk + Database data)
 * Use when you need both Clerk authentication data AND database user info
 * 
 * @example
 * ```typescript
 * @Get('full-profile')
 * async getFullProfile(@CurrentAuthUser() user: AuthenticatedUser) {
 *   const clerkId = user.id;                    // Clerk ID (user_...)
 *   const dbId = user.dbUser.id;                // Database UUID
 *   const email = user.emailAddresses[0];       // Clerk email objects
 *   const dbEmail = user.dbUser.email;          // Database email string
 *   return { clerkId, dbId, email, dbEmail };
 * }
 * ```
 */
export const CurrentAuthUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    return user;
  },
);

/**
 * Get the Clerk user ID (user_...)
 * Rarely needed - most operations should use CurrentUserId for database operations
 * 
 * @example
 * ```typescript
 * @Get('clerk-sync')
 * async syncWithClerk(@ClerkUserId() clerkId: string) {
 *   // Use when interacting directly with Clerk API
 *   return this.clerkService.updateUser(clerkId);
 * }
 * ```
 */
export const ClerkUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    
    if (!user?.id) {
      throw new Error('User not authenticated or Clerk ID not found');
    }
    
    return user.id;
  },
);