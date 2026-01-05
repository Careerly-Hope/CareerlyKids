// src/common/middleware/request-context.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Request Context Middleware
 * 
 * Responsibilities:
 * 1. Ensures every request has a unique request ID
 * 2. Creates metadata ONCE per request (single source of truth)
 * 3. Attaches to request object for downstream consumption
 * 
 * This runs BEFORE any controller or guard logic.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // ✅ Request ID: Create once, use everywhere
    // Check if client sent one, otherwise generate
    if (!req.headers['x-request-id']) {
      req.headers['x-request-id'] = randomUUID();
    }

    // ✅ Attach to response headers for client tracking
    res.setHeader('x-request-id', req.headers['x-request-id'] as string);

    next();
  }
}