// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AssessmentsModule } from './testAssessments/assessments.module';
import { AccessTokensModule } from './tokens/access-token.module';
import { PaymentsModule } from './payments/payment.module';
import { TokenPurchaseModule } from './token-purchase/token-purchase.module';

@Module({
  imports: [
    AuthModule,
    AccessTokensModule,
    AssessmentsModule,
    PaymentsModule,
    TokenPurchaseModule,
    PrismaModule,
    UsersModule,
  ],
  exports: [AuthModule, UsersModule],
})
export class V2Module {}
