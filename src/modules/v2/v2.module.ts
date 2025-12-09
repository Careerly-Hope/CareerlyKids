// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; 
import { PrismaModule } from 'src/prisma/prisma.module';
 

@Module({
  imports: [
   
   PrismaModule
  ],
 
})
export class V2Module {}
