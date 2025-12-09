import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get API information' })
  @ApiResponse({ status: 200, description: 'Returns API details' })
  getRoot() {
    return {
      name: 'Careerly Kids API',
      version: '1.0.0',
      status: 'active',
      availableVersions: ['v1', 'v2'],
      endpoints: {
        v1: '/api/v1',
        v2: '/api/v2',
        health: '/health',
        docs: '/api/docs',
      },
      message: 'Welcome to Careerly Kids Career Assessment Platform',
    };
  }
}
