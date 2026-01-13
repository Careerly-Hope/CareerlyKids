import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('v2/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * 🟡 All Authenticated - GET /v2/users/test-history
   * Get user test history
   */
  @Get('test-history')
  @ApiOperation({
    summary: '🟡 Get user test history',
    description: 'All Authenticated - Returns test history for the current user',
  })
  @ApiResponse({ status: 200, description: 'Returns test history for the user.' })
  async getTestHistory(@CurrentUser() user: AuthenticatedUser['dbUser']) {
    return this.usersService.getTestHistory(user.id);
  }
}
