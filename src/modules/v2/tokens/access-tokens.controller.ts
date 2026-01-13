import { Controller, Get, Param, Query, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TokensService } from './access-token.service';
import { Public } from '../../../common/decorators/public.decorator';
import { AllAuthenticated, SuperAdminOnly } from '../../../common/decorators/roles.decorator';
import { CurrentUserId } from '../../../common/decorators/current-user.decorator';
import { TokenType, TokenStatus } from '@prisma/client';

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
    return this.tokensService.getUserTokens(userId);
  }

  @Get(':code/details')
  @AllAuthenticated()
  @ApiOperation({ summary: 'Get token details (owner only)' })
  async getTokenDetails(@Param('code') code: string, @CurrentUserId() userId: string) {
    return this.tokensService.getTokenDetails(code, userId);
  }

  // ===================================================================
  // PUBLIC TOKEN VALIDATION
  // ===================================================================

  @Post('validate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate token (public)' })
  async validateToken(@Body('token') token: string) {
    return this.tokensService.validateToken(token);
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
    return this.tokensService.getAllTokens({ type, status, page, limit });
  }

  @Post('superAdmin/:code/revoke')
  @SuperAdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke token' })
  async revokeToken(@Param('code') code: string) {
    return this.tokensService.revokeToken(code);
  }
}
