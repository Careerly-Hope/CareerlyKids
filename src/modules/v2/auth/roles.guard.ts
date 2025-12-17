import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRole } from '../../../common/enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    console.log('👮 RolesGuard - URL:', request.url);
    console.log('👮 RolesGuard - User exists?', !!request.user);
    console.log('👮 RolesGuard - User:', request.user?.dbUser?.email);
    
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  
    console.log('👮 RolesGuard - Required roles:', requiredRoles);
  
    if (!requiredRoles) {
      console.log('👮 RolesGuard - No roles required, allowing');
      return true;
    }

    // const request = context.switchToHttp().getRequest();
    const clerkUser = request.user;

    if (!clerkUser) {
      throw new ForbiddenException('User not authenticated');
    }

    const user = await this.prisma.user.findUnique({
      where: { clerkId: clerkUser.id },
    });

    if (!user) {
      throw new ForbiddenException('User not found in database');
    }

    // ✅ Compare string values (both enums have same string values)
    const hasRole = requiredRoles.some(role => role === user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}. Your role: ${user.role}`
      );
    }

    return true;
  }
}