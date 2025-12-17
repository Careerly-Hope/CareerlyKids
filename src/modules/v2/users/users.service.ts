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
  async getTestHistory(clerkId: string) {
    const user = await this.getUserByClerkId(clerkId);

    return await this.prisma.userTestSession.findMany({
      where: { userId: user.id },
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
