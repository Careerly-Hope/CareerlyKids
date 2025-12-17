// src/modules/access-tokens/access-tokens.module.ts
import { Module } from '@nestjs/common';
import { TokensController } from './access-tokens.controller';
import { TokensService } from './access-token.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { EmailModule } from 'src/common/services/email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [TokensController],
  providers: [TokensService],
  exports: [TokensService], // Export so other modules can use it
})
export class AccessTokensModule {}
