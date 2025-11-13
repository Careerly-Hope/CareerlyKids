import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Basic health check - fast response
   */
  async basicHealth() {
    return {
      status: 'ok',
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  /**
   * Wake endpoint - pings database to prevent sleep
   */
  async wake() {
    const startTime = Date.now();

    try {
      // Ping database to wake it up
      await this.prisma.$queryRaw`SELECT 1 as result`;

      const responseTime = Date.now() - startTime;

      this.logger.log(`Wake successful - Database responded in ${responseTime}ms`);

      return {
        status: 'awake',
        timestamp: new Date(),
        database: 'connected',
        responseTime,
      };
    } catch (error) {
      this.logger.error('Wake failed - Database connection error', error.message);

      return {
        status: 'error',
        timestamp: new Date(),
        database: 'disconnected',
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Detailed health check - comprehensive system status
   */
  async detailedHealth() {
    const dbStartTime = Date.now();

    try {
      // Check database connection
      await this.prisma.$queryRaw`SELECT 1 as result`;
      const dbResponseTime = Date.now() - dbStartTime;

      // Get system info
      const memoryUsage = process.memoryUsage();

      return {
        status: 'ok',
        timestamp: new Date(),
        database: {
          status: 'up',
          responseTime: dbResponseTime,
        },
        system: {
          uptime: process.uptime(),
          memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          },
          nodeVersion: process.version,
          platform: process.platform,
        },
      };
    } catch (error) {
      this.logger.error('Detailed health check failed', error.message);

      return {
        status: 'error',
        timestamp: new Date(),
        database: {
          status: 'down',
          responseTime: Date.now() - dbStartTime,
          error: error.message,
        },
        system: {
          uptime: process.uptime(),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          },
        },
      };
    }
  }

  /**
   * Readiness probe - checks if app is ready to receive traffic
   */
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1 as result`;
      return { status: 'ready' };
    } catch (error) {
      this.logger.error('Readiness check failed', error.message);
      throw new Error('Service not ready');
    }
  }

  /**
   * Liveness probe - checks if app is alive
   */
  liveness() {
    return { status: 'alive', timestamp: new Date() };
  }
}