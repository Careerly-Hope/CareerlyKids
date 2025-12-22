import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { getCorsConfig, validateCorsConfig } from './config/cors.config';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';
import 'dotenv/config';
import { V2Module } from './modules/v2/v2.module';
import { TimeoutInterceptor } from './common/interceptor/timeout.interceptor';

async function bootstrap() {
  validateCorsConfig();
  
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const app = await NestFactory.create(AppModule, {
    logger: isProduction 
      ? ['error', 'warn', 'log'] 
      : ['error', 'warn', 'log', 'debug'],
  });

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Global API prefix
  app.setGlobalPrefix('api');

  // Enable URI versioning
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // CORS configuration
  const corsConfig = getCorsConfig();
  app.enableCors(corsConfig);

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global timeout interceptor (30s default)
  app.useGlobalInterceptors(new TimeoutInterceptor(30000));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger setup for V2
  const configV2 = new DocumentBuilder()
    .setTitle('CareerlyKids API - V2')
    .setDescription(
      `
    ## 🎓 CareerlyKids API
    
    Career assessment & guidance platform for students, schools, and organizations.
    
    ---
    
    ### 👥 Roles & Permissions
    
    | Role | Access |
    |-----|-------|
    | 🔴 **SUPER_ADMIN** | Full system access, analytics, tokens, config |
    | 🔵 **ADMIN** | School/org management, bulk tokens, reports |
    | 🟢 **STUDENT** | Take assessments, view results, manage profile |
    | 🟠 **PUBLIC** | Token validation, public info |
    
    ---
    
    ### 🔐 Authentication
    
    Protected endpoints require a Bearer token:
    
    \`\`\`
    Authorization: Bearer <jwt-token>
    \`\`\`
    
    **Dev Quick Start**
    1. Click **Authorize** 🔒  
    2. Call \`POST /v2/auth/dev/generate-token\`  (only email of users in your clerk applications will work)
    3. Paste token → Authorize → Test endpoints
    
    ---
    
    ### 📦 Core Features
    
    | Area | Capabilities |
    |----|-------------|
    | 🎟️ **Tokens** | Individual & bulk, validation, usage tracking |
    | 🧠 **Assessments** | RIASEC profiling, AI stream matching |
    | 👤 **Users** | Clerk auth, profiles, roles, webhooks |
    
    ---
    
    ### 🎯 Endpoint Role Indicators
    
    | Icon | Meaning |
    |----|--------|
    | 🔴 | SUPER_ADMIN only |
    | 🔵 | ADMIN only |
    | 🟢 | STUDENT & above |
    | 🟠 | Public (no auth) |
    
    ---
    
    ### 💰 Pricing
    
    | Quantity | Price |
    |-------|------|
    | 1 Token | ₦5,000 |
    | 20–49 | ₦4,500 (10% off) |
    | 50–99 | ₦4,000 (20% off) |
    | 100+ | ₦3,500 (30% off) |
    
    ---
    
    📩 **Support:** support@careerlykids.com
    `,
    )    .setVersion('2.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your Clerk JWT token',
        in: 'header',
      },
      'bearer',
    )
    .build();

  const documentV2 = SwaggerModule.createDocument(app, configV2, {
    include: [V2Module],
    deepScanRoutes: true,
  });

  SwaggerModule.setup('api/v2/docs', app, documentV2, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;

  await app.listen(port, '0.0.0.0');

  console.log('\n🎉 CareerlyKids API Started Successfully!\n');
  console.log(`📍 Environment: ${nodeEnv}`);
  console.log(`🚀 Server: http://localhost:${port}`);
  console.log(`📚 Docs: http://localhost:${port}/api/v2/docs\n`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});