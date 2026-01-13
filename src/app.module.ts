import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './common/health/health.module';
import { V2Module } from './modules/v2/v2.module';
import { ClerkClientProvider } from './providers/clerk-client.provider';
import { ClerkAuthGuard } from './modules/v2/auth/guards/clerk-auth.guard';
import { RolesGuard } from './modules/v2/auth/guards/roles.guard';
import { RequestIdInterceptor } from './common/interceptor/request-id.interceptor';
import { getRateLimitConfig } from './config/rate-limiting.config';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { ScheduleModule } from '@nestjs/schedule';
// import { getRateLimitConfig } from './config/rate-limit.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),

    ThrottlerModule.forRoot(getRateLimitConfig()),
    PrismaModule,
    HealthModule,
    V2Module,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ClerkClientProvider,
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // ✅ Apply to ALL routes
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
