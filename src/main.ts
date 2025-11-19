import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { getCorsConfig, validateCorsConfig } from './config/cors.config';
import 'dotenv/config';

async function bootstrap() {
  // Validate CORS configuration before starting
  validateCorsConfig();

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // ✅ Apply CORS configuration from environment
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

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('CareerlyKids API')
    .setDescription('API documentation for CareerlyKids application')
    .setVersion('1.0')
    .addTag('assessments', 'RIASEC career assessment endpoints')
    .addTag('statistics', 'Analytics and statistics endpoints')
    .addTag('health', 'Health check and monitoring endpoints')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  const nodeEnv = process.env.NODE_ENV || 'development';

  await app.listen(port);

  console.log('\n🎉 CareerlyKids API Started Successfully!\n');
  console.log(`📍 Environment: ${nodeEnv}`);
  console.log(`🚀 Application: http://localhost:${port}`);
  console.log(`📚 Swagger Docs: http://localhost:${port}/api/docs`);
  console.log(`💚 Health Check: http://localhost:${port}/health`);

  // Log CORS status
  if (process.env.CORS_ENABLED === 'true') {
    const origins = process.env.CORS_ORIGINS || 'all origins (development)';
    console.log(`🌐 CORS enabled for: ${origins}`);
  } else {
    console.log('🔒 CORS disabled');
  }

  console.log('\n');
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
