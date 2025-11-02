/**
 * Error Handler Utilities for Next.js API Routes
 *
 * Provides consistent error handling across all API endpoints
 * with proper status codes, logging, and error formatting.
 *
 * Usage:
 *   import { handleAPIError, asyncHandler } from '@/lib/errors/error-handler'
 *
 *   export const POST = asyncHandler(async (req) => {
 *     // Your route logic
 *     return NextResponse.json({ success: true })
 *   })
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { AppError, isAppError, isOperationalError } from './index'

/**
 * Error response interface
 */
export interface ErrorResponse {
  error: {
    message: string
    code: string
    statusCode: number
    requestId?: string
    context?: Record<string, unknown>
    stack?: string
  }
}

/**
 * Generate unique request ID for error tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

/**
 * Format error for API response
 */
export function formatErrorResponse(
  error: Error | AppError,
  requestId?: string
): ErrorResponse {
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (isAppError(error)) {
    return {
      error: {
        message: error.message,
        code: error.name,
        statusCode: error.statusCode,
        requestId,
        ...(isDevelopment && { context: error.context }),
        ...(isDevelopment && { stack: error.stack }),
      },
    }
  }

  // Generic error
  return {
    error: {
      message: isDevelopment ? error.message : 'An internal error occurred',
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: 500,
      requestId,
      ...(isDevelopment && { stack: error.stack }),
    },
  }
}

/**
 * Handle API errors with proper logging and response
 */
export function handleAPIError(
  error: unknown,
  req?: NextRequest
): NextResponse<ErrorResponse> {
  const requestId = generateRequestId()
  const err = error instanceof Error ? error : new Error(String(error))

  // Log the error
  logger.error('API Error', {
    requestId,
    error: err.message,
    stack: err.stack,
    ...(isAppError(err) && { context: err.context }),
    ...(req && {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
    }),
  })

  // Check if error is operational (expected) or programming error
  if (!isOperationalError(err)) {
    // Programming errors should crash in development
    if (process.env.NODE_ENV === 'development') {
      logger.error('Non-operational error detected!', {
        error: err.message,
        stack: err.stack,
      })
    }

    // In production, log to monitoring service
    // TODO: Send to Sentry or similar service
  }

  // Format and return error response
  const response = formatErrorResponse(err, requestId)
  const statusCode = isAppError(err) ? err.statusCode : 500

  return NextResponse.json(response, { status: statusCode })
}

/**
 * Async handler wrapper for Next.js API routes
 * Automatically catches errors and formats responses
 *
 * Usage:
 *   export const POST = asyncHandler(async (req) => {
 *     const data = await someAsyncOperation()
 *     return NextResponse.json({ data })
 *   })
 */
export function asyncHandler(
  handler: (req: NextRequest, context?: { params: Record<string, string> }) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: { params: Record<string, string> }) => {
    try {
      return await handler(req, context)
    } catch (error) {
      return handleAPIError(error, req)
    }
  }
}

/**
 * Validate required environment variables
 * Throws ConfigurationError if missing
 */
export function validateEnv(variables: string[]): void {
  const missing: string[] = []

  for (const variable of variables) {
    if (!process.env[variable]) {
      missing.push(variable)
    }
  }

  if (missing.length > 0) {
    const errorMessage = `Missing required environment variables: ${missing.join(', ')}`
    logger.error(errorMessage, { missing })
    throw new AppError(errorMessage, 500, false, {
      errorType: 'configuration',
      missing,
    })
  }
}

/**
 * Try-catch wrapper with automatic error logging
 */
export async function tryCatch<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    logger.error(errorMessage, {
      error: error instanceof Error ? error.message : String(error),
      ...context,
    })
    throw error
  }
}

/**
 * Retry logic for transient failures
 */
export async function retry<T>(
  operation: () => Promise<T>,
  {
    maxAttempts = 3,
    delay = 1000,
    backoff = 2,
    onRetry,
  }: {
    maxAttempts?: number
    delay?: number
    backoff?: number
    onRetry?: (attempt: number, error: Error) => void
  } = {}
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxAttempts) {
        logger.error('Retry failed after max attempts', {
          maxAttempts,
          error: lastError.message,
        })
        throw lastError
      }

      const waitTime = delay * Math.pow(backoff, attempt - 1)
      logger.warn(`Retry attempt ${attempt}/${maxAttempts} after ${waitTime}ms`, {
        attempt,
        maxAttempts,
        waitTime,
        error: lastError.message,
      })

      onRetry?.(attempt, lastError)

      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }
  }

  throw lastError || new Error('Retry failed')
}

/**
 * Assert condition or throw error
 */
export function assert(
  condition: boolean,
  message: string,
  ErrorClass: typeof AppError = AppError,
  context?: Record<string, unknown>
): asserts condition {
  if (!condition) {
    throw new ErrorClass(message, context)
  }
}
