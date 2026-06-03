// src/common/decorators/request-metadata.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Extracts request ID from headers
 * Middleware guarantees this exists
 */
export const RequestId = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return req.headers['x-request-id'] as string;
});

/**
 * Extracts client IP address
 * Requires app.set('trust proxy', true) in main.ts
 */
export const ClientIp = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return req.ip || 'unknown';
});

/**
 * Combined request metadata
 * Use when you need both for audit logging
 */
export interface RequestMetadata {
  requestId: string;
  ipAddress: string;
}

export const RequestContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestMetadata => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return {
      requestId: req.headers['x-request-id'] as string,
      ipAddress: req.ip || 'unknown',
    };
  },
);
