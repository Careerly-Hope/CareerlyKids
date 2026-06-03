import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse, ErrorDetail } from '../dto/response.dto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request['requestId'] || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: ErrorDetail[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;

        // Handle validation errors
        if (Array.isArray(responseObj.message)) {
          errors = responseObj.message.map((msg: string) => ({
            message: msg,
            code: 'VALIDATION_ERROR',
          }));
        } else if (responseObj.errors) {
          errors = responseObj.errors;
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    // Don't expose internal errors in production
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && status === HttpStatus.INTERNAL_SERVER_ERROR) {
      message = 'An unexpected error occurred';
      errors = [];
    }

    // Log all errors
    this.logger.error(`[${requestId}] ${request.method} ${request.url} - ${status} - ${message}`);

    const errorResponse = ApiResponse.error(message, errors, requestId);

    response.status(status).json(errorResponse);
  }
}
