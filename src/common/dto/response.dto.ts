export enum ResponseStatus {
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationLinks {
  self: string;
  first: string;
  last: string;
  next?: string;
  prev?: string;
}

export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export class ApiResponse<T = any> {
  status: ResponseStatus;
  message: string;
  data: T | null;
  errors: ErrorDetail[] | null;
  requestId: string;
  timestamp: string;
  meta?: PaginationMeta;
  links?: PaginationLinks;

  constructor(
    status: ResponseStatus,
    message: string,
    data: T | null = null,
    errors: ErrorDetail[] | null = null,
    requestId?: string,
    meta?: PaginationMeta,
    links?: PaginationLinks,
  ) {
    this.status = status;
    this.message = message;
    this.data = data;
    this.errors = errors;
    this.requestId = requestId || 'unknown'; // FIXED: Will be set by interceptor
    this.timestamp = new Date().toISOString();
    if (meta) this.meta = meta;
    if (links) this.links = links;
  }

  static success<T>(
    data: T,
    message = 'Request successful',
    requestId?: string,
  ): ApiResponse<T> {
    return new ApiResponse(
      ResponseStatus.SUCCESS,
      message,
      data,
      null,
      requestId,
    );
  }

  static successWithPagination<T>(
    data: T,
    meta: PaginationMeta,
    links: PaginationLinks,
    message = 'Request successful',
    requestId?: string,
  ): ApiResponse<T> {
    return new ApiResponse(
      ResponseStatus.SUCCESS,
      message,
      data,
      null,
      requestId,
      meta,
      links,
    );
  }

  static error(
    message: string,
    errors: ErrorDetail[] = [],
    requestId?: string,
  ): ApiResponse<null> {
    return new ApiResponse(
      ResponseStatus.ERROR,
      message,
      null,
      errors,
      requestId,
    );
  }

  static created<T>(
    data: T,
    message = 'Resource created successfully',
    requestId?: string,
  ): ApiResponse<T> {
    return new ApiResponse(
      ResponseStatus.SUCCESS,
      message,
      data,
      null,
      requestId,
    );
  }
}