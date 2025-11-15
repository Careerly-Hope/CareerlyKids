import { Controller, Get, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProduces,
} from '@nestjs/swagger';
import { HealthService } from './health.service';
import {
  HealthResponseDto,
  WakeResponseDto,
  DetailedHealthResponseDto,
} from './dto/health-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Basic health check',
    description: 'Quick health check endpoint that responds immediately without database queries'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service is healthy',
    type: HealthResponseDto,
  })
  @ApiProduces('application/json')
  async health() {
    return this.healthService.basicHealth();
  }

  @Get('wake')
  @ApiOperation({
    summary: 'Wake up service and database',
    description: 'Pings the database to prevent Render and Neon from sleeping. Use this endpoint with cron jobs.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service and database awakened successfully',
    type: WakeResponseDto,
  })
  @ApiProduces('application/json')
  async wake() {
    return this.healthService.wake();
  }

  @Get('detailed')
  @ApiOperation({
    summary: 'Detailed health check',
    description: 'Comprehensive health check including database, system memory, and uptime',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detailed health status',
    type: DetailedHealthResponseDto,
  })
  @ApiProduces('application/json')
  async detailedHealth() {
    return this.healthService.detailedHealth();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Kubernetes-style readiness probe. Returns 200 if ready to receive traffic.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service is ready',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Service is not ready',
  })
  async readiness() {
    return this.healthService.readiness();
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Kubernetes-style liveness probe. Returns 200 if service is alive.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service is alive',
  })
  async liveness() {
    return this.healthService.liveness();
  }
}