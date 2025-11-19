// src/modules/assessments/assessments.module.ts
import { Module } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { AssessmentsController } from './assessments.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { StatsController } from './dto/stats.controller';
import { AiModule } from '../ai/ai.module'; // ✅ NEW: Import AI module

@Module({
  imports: [PrismaModule, AiModule], // ✅ NEW: Add AI module
  controllers: [AssessmentsController, StatsController],
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
