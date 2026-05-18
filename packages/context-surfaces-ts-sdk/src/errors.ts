/**
 * Base error class for Cloud Context Surface errors
 */
export class CloudContextSurfaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudContextSurfaceError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error for 401 authentication failures
 */
export class AuthenticationError extends CloudContextSurfaceError {
  readonly statusCode = 401;

  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error for 403 forbidden/access denied responses
 */
export class ForbiddenError extends CloudContextSurfaceError {
  readonly statusCode = 403;

  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Error for 404 not found responses
 */
export class NotFoundError extends CloudContextSurfaceError {
  readonly statusCode = 404;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Error for 400/422 validation errors
 */
export class ValidationError extends CloudContextSurfaceError {
  readonly statusCode = 400;
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Error for 429 rate limit exceeded responses
 */
export class RateLimitError extends CloudContextSurfaceError {
  readonly statusCode = 429;
  readonly retryAfter: number | undefined;

  constructor(message = 'Rate limit exceeded', retryAfter: number | undefined = undefined) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error for other HTTP errors
 */
export class APIError extends CloudContextSurfaceError {
  readonly statusCode: number;
  readonly response: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    response: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.response = response;
  }
}
