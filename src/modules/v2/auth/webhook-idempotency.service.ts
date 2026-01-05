import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class WebhookIdempotencyService {
  private readonly logger = new Logger(WebhookIdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if webhook event has already been processed
   * Returns true if event is new and should be processed
   */
  async shouldProcess(eventId: string, eventType: string): Promise<boolean> {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          eventId,
          eventType,
        },
      });
      return true; // Event is new, should process
    } catch (error) {
      // P2002 = unique constraint violation (duplicate event)
      if (error.code === 'P2002') {
        this.logger.warn(`Duplicate webhook event detected: ${eventId}`);
        return false; // Event already processed
      }
      // Other errors should be thrown
      throw error;
    }
  }

  /**
   * Record webhook event metadata (optional, for debugging)
   */
  async updateMetadata(eventId: string, metadata: Record<string, any>): Promise<void> {
    try {
      await this.prisma.webhookEvent.update({
        where: { eventId },
        data: { metadata },
      });
    } catch (error) {
      this.logger.error(`Failed to update webhook metadata for ${eventId}:`, error);
    }
  }
}