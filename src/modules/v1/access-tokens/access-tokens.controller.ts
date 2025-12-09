// src/modules/access-tokens/access-tokens.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AccessTokensService } from './access-token.service';
// import { EmailService } from '../../common/services/email/email.service';
import { GenerateTokenDto } from './dto/generate-token.dto';
import { ValidateTokenDto } from './dto/validate-token.dto';
import { TokenResponseDto, ValidationResponseDto } from './dto/token-response.dto';
import { TokenStatusDto } from './dto/token-status.dto';
import { EmailService } from 'src/common/services/email/email.service';

@ApiTags('v1/access-tokens')
@Controller('v1/access-tokens')
export class AccessTokensController {
  constructor(
    private readonly accessTokensService: AccessTokensService,
    private readonly emailService: EmailService,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a new access token',
    description:
      'Creates a new access token and sends it to the provided email address. Token type determines usage limits and expiration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Token generated successfully and email sent',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or token generation failed',
  })
  @ApiResponse({
    status: 500,
    description: 'Token generated but email failed to send',
  })
  async generateToken(@Body() dto: GenerateTokenDto) {
    // Generate token
    const result = await this.accessTokensService.generateToken(dto);

    // Send email with token
    try {
      await this.emailService.sendAccessToken({
        email: dto.email,
        name: dto.name,
        school: dto.school,
        token: result.token,
        type: dto.type,
        expiresAt: result.expiresAt,
        maxUsage: result.maxUsage,
      });

      return {
        ...result,
        message: 'Token generated successfully and sent to email',
      };
    } catch (emailError) {
      // Token was created but email failed - log and inform user
      console.error('Email delivery failed:', emailError);

      // In production, you might want to:
      // 1. Queue email for retry
      // 2. Mark token for manual delivery
      // 3. Send admin notification

      throw new InternalServerErrorException(
        'Token generated but email delivery failed. Please contact support with token ID: ' +
          result.tokenId,
      );
    }
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate an access token',
    description: 'Checks if a token is valid, not expired, and has remaining usage',
  })
  @ApiResponse({
    status: 200,
    description: 'Token validation result',
    type: ValidationResponseDto,
  })
  async validateToken(@Body() dto: ValidateTokenDto) {
    const validation = await this.accessTokensService.validateToken(dto.token);

    if (!validation.valid) {
      return {
        valid: false,
        reason: validation.reason,
      };
    }

    const token = validation.token!;
    return {
      valid: true,
      type: token.type,
      remainingUsage: token.maxUsage - token.usageCount,
      expiresAt: token.expiresAt,
    };
  }

  @Get('status/:token')
  @ApiOperation({
    summary: 'Get detailed token status',
    description: 'Retrieves comprehensive information about a token including usage statistics',
  })
  @ApiParam({
    name: 'token',
    description: 'Access token string',
    example: 'STANF-A3F8',
  })
  @ApiResponse({
    status: 200,
    description: 'Token status retrieved',
    type: TokenStatusDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Token not found',
  })
  async getTokenStatus(@Param('token') token: string) {
    return this.accessTokensService.getTokenStatus(token);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke an access token',
    description: 'Permanently disables a token, preventing further use',
  })
  @ApiResponse({
    status: 200,
    description: 'Token revoked successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Token not found',
  })
  async revokeToken(@Body() dto: ValidateTokenDto) {
    await this.accessTokensService.revokeToken(dto.token);
    return {
      success: true,
      message: 'Token revoked successfully',
    };
  }

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend access token email',
    description: 'Resends the access token email if the original was not received',
  })
  @ApiResponse({
    status: 200,
    description: 'Email resent successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Token not found or cannot be resent',
  })
  async resendToken(@Body() dto: ValidateTokenDto) {
    // Get token details
    // const tokenInfo = await this.accessTokensService.getTokenStatus(dto.token);

    // Fetch full token details from service
    const validation = await this.accessTokensService.validateToken(dto.token);

    if (!validation.token) {
      throw new InternalServerErrorException('Token details not available');
    }

    const token = validation.token;

    // Resend email
    await this.emailService.sendAccessToken({
      email: token.email,
      name: token.name || undefined,
      school: token.school || undefined,
      token: token.token,
      type: token.type,
      expiresAt: token.expiresAt,
      maxUsage: token.maxUsage,
    });

    return {
      success: true,
      message: 'Token email resent successfully',
    };
  }
}
