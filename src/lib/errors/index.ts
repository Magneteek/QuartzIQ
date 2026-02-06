/**
 * Custom Error Classes for QuartzIQ
 *
 * Provides specific error types for different failure scenarios
 * with structured error data for better debugging and monitoring.
 *
 * Usage:
 *   throw new APIError('Apollo API rate limit exceeded', { service: 'apollo', limit: 100 })
 *   throw new DatabaseError('Failed to insert business', { businessId: '123', table: 'businesses' })
 */

/**
 * Base application error class
 * All custom errors extend from this
 */
export class AppError extends Error {
  public readonly name: string
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly context?: Record<string, unknown>
  public readonly timestamp: Date

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)

    this.name = this.constructor.name
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.context = context
    this.timestamp = new Date()

    Error.captureStackTrace(this)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
    }
  }
}

/**
 * API-related errors (external services)
 */
export class APIError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 502, true, { ...context, errorType: 'api' })
  }
}

/**
 * Database-related errors
 */
export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 500, true, { ...context, errorType: 'database' })
  }
}

/**
 * Validation errors (user input)
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 400, true, { ...context, errorType: 'validation' })
  }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 401, true, { ...context, errorType: 'authentication' })
  }
}

/**
 * Authorization errors
 */
export class AuthorizationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 403, true, { ...context, errorType: 'authorization' })
  }
}

/**
 * Not found errors
 */
export class NotFoundError extends AppError {
  constructor(resource: string, context?: Record<string, unknown>) {
    super(`${resource} not found`, 404, true, { ...context, errorType: 'not_found', resource })
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 429, true, { ...context, errorType: 'rate_limit' })
  }
}

/**
 * External service quota exceeded
 */
export class QuotaExceededError extends AppError {
  constructor(service: string, limit: number, context?: Record<string, unknown>) {
    super(`${service} quota exceeded (limit: ${limit})`, 402, true, {
      ...context,
      errorType: 'quota_exceeded',
      service,
      limit,
    })
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 500, false, { ...context, errorType: 'configuration' })
  }
}

/**
 * Business logic errors
 */
export class BusinessLogicError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 422, true, { ...context, errorType: 'business_logic' })
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/**
 * Type guard to check if error is operational
 */
export function isOperationalError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.isOperational
  }
  return false
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error
  }

  if (error instanceof Error) {
    return new AppError(error.message, 500, true, { originalError: error.name })
  }

  if (typeof error === 'string') {
    return new AppError(error, 500, true)
  }

  return new AppError('An unknown error occurred', 500, true, {
    originalError: JSON.stringify(error),
  })
}
