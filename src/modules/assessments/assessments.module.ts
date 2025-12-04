// src/modules/assessments/assessments.module.ts
import { Module } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { AssessmentsController } from './assessments.controller';
import { PrismaModule } from '../../prisma/prisma.module';
// import { StatsController } from './stats.controller';
import { AiModule } from '../ai/ai.module'; // ✅ NEW: Import AI module
import { AccessTokensModule } from '../access-tokens/access-token.module';
import { EmailService } from 'src/common/services/email/email.service';

@Module({
  imports: [PrismaModule, AiModule, AccessTokensModule], // ✅ NEW: Add AI module
  controllers: [AssessmentsController],
  providers: [AssessmentsService,EmailService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
