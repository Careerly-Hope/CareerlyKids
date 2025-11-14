# Development Guide

## Setup Development Environment

### 1. Install Prerequisites

- Node.js 18.x or 20.x
- npm or yarn
- Git
- PostgreSQL (optional - can use Neon)

### 2. Clone and Install
```bash
git clone https://github.com/YOUR_USERNAME/CareerlyKids.git
cd CareerlyKids
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL="your-database-url"
NODE_ENV="development"
PORT=3000
```

### 4. Database Setup
```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Seed database
npx prisma db seed
```

### 5. Start Development Server
```bash
npm run start:dev
```

Visit:
- App: http://localhost:3000
- Swagger: http://localhost:3000/api/docs

## Creating a New Feature

### 1. Generate Module
```bash
nest generate module features/users
nest generate controller features/users
nest generate service features/users
```

### 2. Create DTOs
```typescript
// src/features/users/dto/create-user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  name: string;
}
```

### 3. Add to Prisma Schema
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
```

### 4. Run Migration
```bash
npx prisma migrate dev --name add_users
```

### 5. Implement Service
```typescript
// src/features/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({
      data: createUserDto,
    });
  }

  async findAll() {
    return this.prisma.user.findMany();
  }
}
```

### 6. Implement Controller
```typescript
// src/features/users/users.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create user' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  findAll() {
    return this.usersService.findAll();
  }
}
```

### 7. Write Tests
```typescript
// src/features/users/users.service.spec.ts
import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a user', async () => {
    const dto = { email: 'test@test.com', name: 'Test' };
    jest.spyOn(prisma.user, 'create').mockResolvedValue({
      id: '1',
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create(dto);
    expect(result).toHaveProperty('id');
  });
});
```

### 8. Test Your Feature
```bash
# Run tests
npm run test

# Test manually
npm run start:dev
# Visit http://localhost:3000/api/docs
```

### 9. Commit and Push
```bash
git add .
git commit -m "feat: add users module"
git push origin development
```

## Debugging

### VS Code Launch Config

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeArgs": ["--nolazy", "-r", "ts-node/register"],
      "args": ["${workspaceFolder}/src/main.ts"],
      "env": {
        "NODE_ENV": "development"
      },
      "sourceMaps": true,
      "cwd": "${workspaceFolder}",
      "protocol": "inspector"
    }
  ]
}
```

## Common Commands
```bash
# Generate resources
nest g module features/feature-name
nest g controller features/feature-name
nest g service features/feature-name

# Database
npx prisma studio              # Open Prisma Studio
npx prisma migrate dev         # Create migration
npx prisma migrate deploy      # Deploy migration
npx prisma db seed            # Seed database

# Testing
npm run test                   # Unit tests
npm run test:watch            # Watch mode
npm run test:cov              # Coverage
npm run test:e2e              # E2E tests

# Code quality
npm run lint                   # Run linter
npm run format                 # Format code
```

## Tips

1. **Use Swagger decorators** for all endpoints
2. **Validate DTOs** with class-validator
3. **Handle errors** with proper exceptions
4. **Write tests** before pushing
5. **Check Swagger docs** after adding endpoints
6. **Use Prisma Studio** for database inspection