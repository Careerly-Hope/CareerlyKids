// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; 
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
 

@Module({
  imports: [
   AuthModule,
   PrismaModule,
   UsersModule
  ],
  exports: [AuthModule, UsersModule],
 
})
export class V2Module {}
