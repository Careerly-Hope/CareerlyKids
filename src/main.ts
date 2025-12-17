import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { getCorsConfig, validateCorsConfig } from './config/cors.config';
import 'dotenv/config';

async function bootstrap() {
  validateCorsConfig();
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  // Enable URI versioning
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // CORS configuration
  const corsConfig = getCorsConfig();
  app.enableCors(corsConfig);

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

  // Swagger setup for V2 - ONLY V2 routes - FIXED HERE
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
    )

    .setVersion('2.0')
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
    include: [(await import('./modules/v2/v2.module')).V2Module],
    deepScanRoutes: true,
  });
  SwaggerModule.setup('api/v2/docs', app, documentV2, {
    swaggerOptions: {
      persistAuthorization: true, // Keeps token after page refresh
    },
  });

  // Main docs (combined) - All routes - FIXED HERE TOO
  const configMain = new DocumentBuilder()
    .setTitle('CareerlyKids API')
    .setDescription('Complete API documentation for all versions')
    .setVersion('1.0')
    .addTag('root')
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
  const documentMain = SwaggerModule.createDocument(app, configMain);
  SwaggerModule.setup('api/docs', app, documentMain, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  const nodeEnv = process.env.NODE_ENV || 'development';

  await app.listen(port);

  console.log('\n🎉 CareerlyKids API Started Successfully!\n');
  console.log(`📍 Environment: ${nodeEnv}`);
  console.log(`🚀 Application: http://localhost:${port}`);
  console.log(`📚 Main Docs: http://localhost:${port}/api/docs`);
  console.log(`📗 V2 Docs: http://localhost:${port}/api/v2/docs`);
  console.log(`💚 Health Check: http://localhost:${port}/health`);
  console.log(`📍 Root Info: http://localhost:${port}/api`);

  if (process.env.CORS_ENABLED === 'true') {
    const origins = process.env.CORS_ORIGINS || 'all origins (development)';
    console.log(`🌐 CORS enabled for: ${origins}`);
  } else {
    console.log('🔒 CORS disabled');
  }

  console.log('\n✨ Available API Versions:');
  console.log('   V1: /api/v1/* (Active - Simple Assessment)');
  console.log('   V2: /api/v2/* (In Development - Full Platform)');
  console.log('\n');
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
