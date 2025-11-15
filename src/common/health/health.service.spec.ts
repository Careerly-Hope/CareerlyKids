import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('basicHealth', () => {
    it('should return basic health info', async () => {
      const result = await service.basicHealth();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('environment');
      expect(result).toHaveProperty('version');
    });
  });

  describe('wake', () => {
    it('should wake database successfully', async () => {
      const result = await service.wake();
      expect(result).toHaveProperty('status', 'awake');
      expect(result).toHaveProperty('database', 'connected');
      expect(result).toHaveProperty('responseTime');
      expect(prismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      jest.spyOn(prismaService, '$queryRaw').mockRejectedValueOnce(new Error('DB Error'));
      const result = await service.wake();
      expect(result).toHaveProperty('status', 'error');
      expect(result).toHaveProperty('database', 'disconnected');
    });
  });

  describe('liveness', () => {
    it('should return alive status', () => {
      const result = service.liveness();
      expect(result).toHaveProperty('status', 'alive');
      expect(result).toHaveProperty('timestamp');
    });
  });
});
