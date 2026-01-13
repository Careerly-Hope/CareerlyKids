// src/modules/v2/tokens/access-token.controller.ts
import { Controller, Get, Param, Query, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TokensService } from './access-token.service';
import { Public } from '../../../common/decorators/public.decorator';
import { AllAuthenticated, SuperAdminOnly } from '../../../common/decorators/roles.decorator';
import { CurrentUserId } from '../../../common/decorators/current-user.decorator';
import { TokenType, TokenStatus } from '@prisma/client';
import { ApiResponse } from '../../../common/dto/response.dto';

@ApiTags('Tokens')
@Controller('tokens')
@ApiBearerAuth('bearer')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  // ===================================================================
  // USER TOKEN QUERIES
  // ===================================================================
  @Get('my-tokens')
  @AllAuthenticated()
  @ApiOperation({ summary: 'Get my purchased tokens' })
  async getMyTokens(@CurrentUserId() userId: string) {
    const tokens = await this.tokensService.getUserTokens(userId);
    return ApiResponse.success(tokens, 'User tokens retrieved successfully');
  }

  @Get(':code/details')
  @AllAuthenticated()
  @ApiOperation({ summary: 'Get token details (owner only)' })
  async getTokenDetails(@Param('code') code: string, @CurrentUserId() userId: string) {
    const details = await this.tokensService.getTokenDetails(code, userId);
    return ApiResponse.success(details, 'Token details retrieved successfully');
  }

  // ===================================================================
  // PUBLIC TOKEN VALIDATION
  // ===================================================================
  @Post('validate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate token (public)' })
  async validateToken(@Body('token') token: string) {
    const validation = await this.tokensService.validateToken(token);
    return ApiResponse.success(validation, 'Token validated successfully');
  }

  // ===================================================================
  // ADMIN ENDPOINTS
  // ===================================================================
  @Get('superAdmin/all')
  @SuperAdminOnly()
  @ApiOperation({ summary: 'List all tokens (platform-wide)' })
  async getAllTokens(
    @Query('type') type?: TokenType,
    @Query('status') status?: TokenStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const tokens = await this.tokensService.getAllTokens({ type, status, page, limit });
    return ApiResponse.success(tokens, 'All tokens retrieved successfully');
  }

  @Post('superAdmin/:code/revoke')
  @SuperAdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke token' })
  async revokeToken(@Param('code') code: string) {
    const result = await this.tokensService.revokeToken(code);
    return ApiResponse.success(result, 'Token revoked successfully');
  }
}