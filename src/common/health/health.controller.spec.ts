import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            basicHealth: jest.fn().mockResolvedValue({
              status: 'ok',
              timestamp: new Date(),
              environment: 'test',
              version: '1.0.0',
            }),
            wake: jest.fn().mockResolvedValue({
              status: 'awake',
              timestamp: new Date(),
              database: 'connected',
              responseTime: 100,
            }),
            detailedHealth: jest.fn().mockResolvedValue({
              status: 'ok',
              timestamp: new Date(),
              database: { status: 'up', responseTime: 50 },
              system: { uptime: 3600, memory: { used: 150, total: 512 } },
            }),
            readiness: jest.fn().mockResolvedValue({ status: 'ready' }),
            liveness: jest.fn().mockReturnValue({ status: 'alive', timestamp: new Date() }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call health service for basic health', async () => {
    await controller.health();
    expect(service.basicHealth).toHaveBeenCalled();
  });

  it('should call health service for wake', async () => {
    await controller.wake();
    expect(service.wake).toHaveBeenCalled();
  });
});
