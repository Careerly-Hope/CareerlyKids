import { Module } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { AssessmentsController } from './assessments.controller';
// import { StatsController } from './stats.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { StatsController } from './dto/stats.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AssessmentsController, StatsController],
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
