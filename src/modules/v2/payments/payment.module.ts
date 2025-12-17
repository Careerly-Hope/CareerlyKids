// src/modules/v2/payments/payments.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payment.controller';
import { PaymentsService } from './payment.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AccessTokensModule } from '../tokens/access-token.module';
import { TokenPurchaseModule } from '../token-purchase/token-purchase.module';

@Module({
  imports: [
    PrismaModule,
   ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService], 
})
export class PaymentsModule {}
