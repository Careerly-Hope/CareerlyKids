import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Generate or use existing request ID
    const requestId = request.headers['x-request-id'] || `req_${uuidv4()}`;

    // Attach to request for use in controllers/services
    request.requestId = requestId;

    // Add to response headers
    response.setHeader('X-Request-Id', requestId);

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        // Log request completion with ID
        console.log(
          `[${requestId}] ${request.method} ${request.url} - ${response.statusCode} - ${duration}ms`,
        );
      }),
    );
  }
}
