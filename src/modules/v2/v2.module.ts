// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AssessmentsModule } from './testAssessments/assessments.module';
import { AccessTokensModule } from './tokens/access-token.module';
import { PaymentsModule } from './payments/payment.module';
import { TokenPurchaseModule } from './token-purchase/token-purchase.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    AccessTokensModule,
    AssessmentsModule,
    PaymentsModule,
    TokenPurchaseModule,
    PrismaModule,
    UsersModule,
  ],
  exports: [AuthModule, UsersModule, AuditModule],
})
export class V2Module {}
