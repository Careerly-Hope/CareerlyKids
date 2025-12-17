import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { ClerkStrategy } from './clerk.strategy';
import { ClerkClientProvider } from '../../../providers/clerk-client.provider';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { RolesGuard } from './roles.guard';
// import { RolesGuard } from './roles.guard';

@Module({
  imports: [PassportModule, ConfigModule, PrismaModule],
  controllers: [AuthController],
  providers: [ClerkStrategy, ClerkClientProvider, AuthService, RolesGuard],
  exports: [PassportModule, AuthService, RolesGuard],
})
export class AuthModule {}
