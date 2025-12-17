import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
// import { HealthModule } from './common/health/health.module';
// import { V1Module } from './modules/v1/v1.module';
import { V2Module } from './modules/v2/v2.module';
import { ClerkClientProvider } from './providers/clerk-client.provider';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClerkAuthGuard } from './modules/v2/auth/clerk-auth.guard';
import { RolesGuard } from './modules/v2/auth/roles.guard';
import { RequestIdInterceptor } from './common/interceptor/request-id.interceptor';
import { EventEmitterModule } from '@nestjs/event-emitter';
// import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    PrismaModule,
    // HealthModule,
    V2Module,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ClerkClientProvider,
    // FIXED: Apply guards in correct order
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard, // First: Authentication
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // Second: Authorization
    },
    // FIXED: Add request ID tracking
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
  ],
})
export class AppModule {}
