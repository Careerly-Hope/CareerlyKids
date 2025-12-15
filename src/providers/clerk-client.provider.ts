import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { Logger, InternalServerErrorException } from '@nestjs/common';

export const ClerkClientProvider = {
  provide: 'ClerkClient',
  useFactory: (configService: ConfigService) => {
    const logger = new Logger('ClerkClientProvider');

    // FIXED: Validate Clerk credentials
    const publishableKey = configService.get('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    const secretKey = configService.get('CLERK_SECRET_KEY');
    const nodeEnv = configService.get('NODE_ENV');

    // In production, require valid keys
    if (nodeEnv === 'production') {
      if (!publishableKey || !secretKey) {
        logger.error('❌ Clerk credentials not configured for production');
        throw new InternalServerErrorException(
          'Clerk authentication not properly configured',
          );
          }
            if (!publishableKey.startsWith('pk_')) {
              logger.error('❌ Invalid Clerk publishable key format');
              throw new InternalServerErrorException(
                'Invalid Clerk configuration',
              );
            }
          
            if (!secretKey.startsWith('sk_')) {
              logger.error('❌ Invalid Clerk secret key format');
              throw new InternalServerErrorException(
                'Invalid Clerk configuration',
              );
            }
          }
          
          // In development, allow but warn
          if (nodeEnv === 'development') {
            if (!publishableKey || !secretKey) {
              logger.warn('⚠️  Clerk credentials not set - dev mode will use mock auth');
            } else {
              logger.log('✅ Clerk client initialized for development');
            }
          }
          
          try {
            return createClerkClient({
              publishableKey,
              secretKey,
            });
          } catch (error) {
            logger.error('Failed to initialize Clerk client:', error);
            throw new InternalServerErrorException(
              'Failed to initialize authentication service',
            );
          }
          },
          inject: [ConfigService],
          };