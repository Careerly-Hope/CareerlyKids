import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ClerkStrategy } from './clerk.strategy'; 
import { WebhookHandlerService } from './services/webhook-handler.service';
import { ProfileUpdateService } from './services/profile-update.service';
import { AccountDeletionService } from './services/account-deletion.service';
import { DevUtilitiesService } from './services/dev-utilities.service';
import { ProfileReconciliationService } from './services/profile-reconciliation.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { WebhookIdempotencyService } from './services/webhook-idempotency.service';

@Module({
  imports: [ConfigModule, PrismaModule, AuditModule],
  controllers: [AuthController],
  providers: [
    // Main orchestrator
    AuthService,
    
    // ✅ ADD CLERK STRATEGY HERE
    ClerkStrategy,
    
    // Specialized services
    WebhookHandlerService,
    ProfileUpdateService,
    AccountDeletionService,
    DevUtilitiesService,
    ProfileReconciliationService,
    
    // Supporting services
    WebhookIdempotencyService,
    
    // Clerk client
    {
      provide: 'ClerkClient',
      useFactory: (configService: ConfigService) => {
        return createClerkClient({
          secretKey: configService.get<string>('CLERK_SECRET_KEY'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    AuthService,
    WebhookHandlerService,
    ProfileUpdateService,
    AccountDeletionService,
    DevUtilitiesService,
    ProfileReconciliationService,
  ],
})
export class AuthModule {}