// src/app.module.ts
import { Module } from '@nestjs/common';

import { AssessmentsModule } from './assessments/assessments.module';
import { AccessTokensModule } from './access-tokens/access-token.module';

@Module({
  imports: [AssessmentsModule, AccessTokensModule],
})
export class V1Module {}
