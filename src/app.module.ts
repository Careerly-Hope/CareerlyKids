import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './common/health/health.module';
import { V1Module } from './modules/v1/v1.module';
import { V2Module } from './modules/v2/v2.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    HealthModule,
    V1Module,
    V2Module,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}