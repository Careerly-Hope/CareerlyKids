// src/modules/v2/token-purchase/token-purchase.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AccessTokensModule } from '../tokens/access-token.module';
import { PaymentsModule } from '../payments/payment.module';
import { TokenPurchaseController } from './token-purchase.controller';
import { TokenPurchaseOrchestrator } from './token-purchase.orchestrator';

@Module({
  imports: [PrismaModule, PaymentsModule, AccessTokensModule],
  controllers: [TokenPurchaseController],
  providers: [TokenPurchaseOrchestrator],
  exports: [TokenPurchaseOrchestrator],
})
export class TokenPurchaseModule {}
