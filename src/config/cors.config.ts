import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * CORS Configuration based on environment variables
 *
 * Security considerations:
 * - In development: Allow localhost origins
 * - In production: Only allow specific frontend domains
 * - Never use '*' in production with credentials enabled
 */
export function getCorsConfig(): CorsOptions {
  const corsEnabled = process.env.CORS_ENABLED === 'true';

  if (!corsEnabled) {
    return { origin: false };
  }

  const originsEnv = process.env.CORS_ORIGINS || '';
  const allowCredentials = process.env.CORS_CREDENTIALS === 'true';
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Parse allowed origins from comma-separated string
  const allowedOrigins = originsEnv
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  // Development: Be more permissive
  if (nodeEnv === 'development' && allowedOrigins.length === 0) {
    console.warn('⚠️  CORS enabled but no origins specified. Allowing all origins in development.');
    return {
      origin: true,
      credentials: allowCredentials,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      maxAge: 86400, // 24 hours
    };
  }

  // Production: Strict origin checking
  if (allowedOrigins.length === 0) {
    console.error('❌ CORS enabled but no origins specified. Disabling CORS.');
    return { origin: false };
  }

  console.log(`✅ CORS enabled for origins: ${allowedOrigins.join(', ')}`);

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️  Blocked CORS request from unauthorized origin: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: allowCredentials,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours - browsers cache preflight requests
  };
}

/**
 * Validate CORS configuration on startup
 */
export function validateCorsConfig(): void {
  const corsEnabled = process.env.CORS_ENABLED === 'true';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const origins = process.env.CORS_ORIGINS || '';

  if (!corsEnabled) {
    console.log('ℹ️  CORS is disabled');
    return;
  }

  if (nodeEnv === 'production' && !origins) {
    console.error('❌ CRITICAL: CORS enabled in production without specified origins!');
    console.error('   Set CORS_ORIGINS environment variable with your frontend domain(s)');
    throw new Error('CORS misconfiguration in production');
  }

  if (nodeEnv === 'production' && origins.includes('localhost')) {
    console.warn('⚠️  WARNING: Localhost origin detected in production CORS config');
  }

  if (origins.includes('*')) {
    console.error('❌ CRITICAL: Wildcard (*) origin not allowed with credentials');
    throw new Error('Invalid CORS configuration');
  }
}
