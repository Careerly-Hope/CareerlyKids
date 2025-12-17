import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "src/common/decorators/public.decorator";

@Injectable()
export class ClerkAuthGuard extends AuthGuard('clerk') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    console.log('🔐 ClerkAuthGuard - URL:', request.url);
    console.log('🔐 ClerkAuthGuard - Headers:', request.headers.authorization);
    
    const isPublic = this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      console.log('🔓 Public route, skipping auth');
      return true;
    }

    console.log('🔒 Protected route, validating token...');
    return super.canActivate(context);
  }
}