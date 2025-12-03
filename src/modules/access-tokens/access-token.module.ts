// src/modules/access-tokens/access-tokens.module.ts
import { Module } from '@nestjs/common';
import { AccessTokensController } from './access-tokens.controller';
import { AccessTokensService } from './access-token.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from 'src/common/services/email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [AccessTokensController],
  providers: [AccessTokensService],
  exports: [AccessTokensService], // Export so other modules can use it
})
export class AccessTokensModule {}
