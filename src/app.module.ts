// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // ✅ ADD THIS
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './common/health/health.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { AccessTokensModule } from './modules/access-tokens/access-token.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    HealthModule,
    AssessmentsModule,
    AccessTokensModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
