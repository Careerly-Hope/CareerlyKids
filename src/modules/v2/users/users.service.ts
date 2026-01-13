import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user by Clerk ID
   */
  private async getUserByClerkId(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Get test history
   */
  async getTestHistory(userId: string) {
    return this.prisma.userTestSession.findMany({
      where: { userId },
      include: {
        session: {
          include: {
            result: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
