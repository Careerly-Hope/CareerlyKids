import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', description: 'Health status' })
  status: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  timestamp: Date;

  @ApiProperty({ example: 'development' })
  environment: string;

  @ApiProperty({ example: '1.0.0' })
  version: string;
}

export class WakeResponseDto {
  @ApiProperty({ example: 'awake', description: 'Wake status' })
  status: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  timestamp: Date;

  @ApiProperty({ example: 'connected' })
  database: string;

  @ApiProperty({ example: 150, description: 'Response time in ms' })
  responseTime: number;
}

export class DetailedHealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  timestamp: Date;

  @ApiProperty({
    example: {
      status: 'up',
      responseTime: 50,
    },
  })
  database: {
    status: string;
    responseTime: number;
  };

  @ApiProperty({
    example: {
      uptime: 3600,
      memory: {
        used: 150,
        total: 512,
      },
    },
  })
  system: {
    uptime: number;
    memory: {
      used: number;
      total: number;
    };
  };
}
