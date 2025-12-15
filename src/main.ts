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

  // Swagger setup for V1 - ONLY V1 routes
  const configV1 = new DocumentBuilder()
    .setTitle('CareerlyKids API - V1')
    .setDescription('Version 1 - Simple Assessment Platform')
    .setVersion('1.0')
    .addTag('v1')
    .build();
  const documentV1 = SwaggerModule.createDocument(app, configV1, {
    include: [
      (await import('./modules/v1/v1.module')).V1Module,
    ],
    deepScanRoutes: true,
  });
  SwaggerModule.setup('api/v1/docs', app, documentV1);

  // Swagger setup for V2 - ONLY V2 routes - FIXED HERE
  const configV2 = new DocumentBuilder()
    .setTitle('CareerlyKids API - V2')
    .setDescription('Version 2 - Full Platform with Auth, Payments, and Guest Support')
    .setVersion('2.0')
    .addTag('v2')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your Clerk JWT token',
        in: 'header',
      },
      'bearer', // This is the security scheme name
    )
    .build();
  const documentV2 = SwaggerModule.createDocument(app, configV2, {
    include: [
      (await import('./modules/v2/v2.module')).V2Module,
    ],
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
  console.log(`📘 V1 Docs: http://localhost:${port}/api/v1/docs`);
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