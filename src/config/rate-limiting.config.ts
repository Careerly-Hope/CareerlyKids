import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const getRateLimitConfig = (): ThrottlerModuleOptions => {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Development: More permissive
  if (nodeEnv === 'development') {
    return {
      throttlers: [
        {
          ttl: 60000, // 1 minute
          limit: 100, // 100 requests
        },
      ],
    };
  }

  // Production: Stricter limits
  return {
    throttlers: [
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 20,
      },
      {
        name: 'long',
        ttl: 900000, // 15 minutes
        limit: 100,
      },
    ],
  };
};