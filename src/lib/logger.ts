/**
 * Centralized Logging Utility with Pino
 *
 * Provides environment-aware structured logging with Pino.
 * In production, logs are in JSON format for log aggregation.
 * In development, pretty-printed colorized output.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info('Extraction started', { category: 'dentist', location: 'Amsterdam' })
 *   logger.error('API failed', { error: err.message })
 *
 * Advanced usage:
 *   const apiLogger = logger.child({ module: 'apollo-api' })
 *   const timing = logger.time('database-query')
 *   timing.end()  // Logs duration automatically
 */

import pino from 'pino'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogContext = Record<string, unknown>

class Logger {
  private isDevelopment: boolean
  private isClient: boolean
  private pino: pino.Logger | null = null

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production'
    this.isClient = typeof window !== 'undefined'

    // Initialize Pino only on server-side
    if (!this.isClient) {
      this.initializePino()
    }
  }

  private initializePino(): void {
    const isTest = process.env.NODE_ENV === 'test'

    // Disable Pino in development to avoid worker thread issues with Next.js hot reload
    // Use console logging instead (cleaner and more stable)
    if (this.isDevelopment && !isTest) {
      this.pino = null
      return
    }

    this.pino = pino({
      level: process.env.LOG_LEVEL || 'info',

      serializers: {
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },

      base: {
        env: process.env.NODE_ENV,
        app: 'quartziq',
      },

      timestamp: () => `,"time":"${new Date().toISOString()}"`,

      // Silent for tests
      ...(isTest && {
        level: 'silent',
      }),
    })
  }

  /**
   * Debug: Detailed information for diagnosing issues
   * Only logged in development
   */
  debug(message: string, context?: LogContext): void {
    if (!this.isDevelopment) return
    this.log('debug', message, context)
  }

  /**
   * Info: General informational messages
   * Only logged in development
   */
  info(message: string, context?: LogContext): void {
    if (!this.isDevelopment) return
    this.log('info', message, context)
  }

  /**
   * Warn: Warning messages that don't halt execution
   * Logged in all environments
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  /**
   * Error: Error messages that require attention
   * Logged in all environments
   */
  error(message: string, context?: LogContext): void {
    this.log('error', message, context)
  }

  /**
   * Internal logging method with structured output
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    // Client-side: fallback to console with emoji prefixes
    if (this.isClient) {
      const prefix = this.getPrefix(level)
      const logData = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...(context && { context }),
        client: true,
      }

      switch (level) {
        case 'debug':
          console.debug(prefix, message, context || '')
          break
        case 'info':
          console.log(prefix, message, context || '')
          break
        case 'warn':
          console.warn(prefix, message, context || '')
          break
        case 'error':
          console.error(prefix, message, context || '', logData)
          break
      }
      return
    }

    // Server-side: use Pino for structured logging (production only)
    if (this.pino) {
      const logContext = context || {}

      this.pino[level](logContext, message)
    } else {
      // Development mode: use console logging with emoji prefixes
      const prefix = this.getPrefix(level)
      console[level === 'debug' ? 'debug' : level](prefix, message, context || '')
    }

    // In production, send errors to monitoring service
    if (!this.isDevelopment && level === 'error' && !this.isClient) {
      this.reportError(message, context)
    }
  }

  /**
   * Report errors to external monitoring service
   */
  private reportError(_message: string, _context?: LogContext): void {
    // TODO: Integrate with error monitoring service (Sentry, etc.)
    // Example:
    // if (process.env.SENTRY_DSN) {
    //   Sentry.captureException(new Error(_message), {
    //     extra: _context,
    //   })
    // }
  }

  /**
   * Get emoji prefix for log level
   */
  private getPrefix(level: LogLevel): string {
    const prefixes = {
      debug: '🔍 [DEBUG]',
      info: '📊 [INFO]',
      warn: '⚠️  [WARN]',
      error: '❌ [ERROR]'
    }
    return prefixes[level]
  }

  /**
   * Group related logs together (useful for extraction flows)
   */
  group(label: string): void {
    if (!this.isDevelopment) return
    console.group(`📦 ${label}`)
  }

  groupEnd(): void {
    if (!this.isDevelopment) return
    console.groupEnd()
  }

  /**
   * Create a child logger with persistent context
   */
  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context)
  }

  /**
   * Performance timing helper
   * Automatically logs operation duration
   */
  time(operation: string, context?: LogContext): { end: () => void } {
    const start = Date.now()
    this.debug(`Starting ${operation}`, context)

    return {
      end: () => {
        const duration = Date.now() - start
        const logContext = { ...context, duration, operation }

        if (duration > 5000) {
          this.warn(`Slow operation: ${operation} (${duration}ms)`, logContext)
        } else {
          this.info(`Completed ${operation} (${duration}ms)`, logContext)
        }
      },
    }
  }

  /**
   * API request logger with automatic timing
   */
  apiRequest(method: string, endpoint: string, context?: LogContext) {
    const start = Date.now()
    const requestId = Math.random().toString(36).substring(7)

    this.info(`API Request: ${method} ${endpoint}`, {
      method,
      endpoint,
      requestId,
      ...context,
    })

    return {
      success: (statusCode: number, additional?: LogContext) => {
        const duration = Date.now() - start
        this.info(`API Success: ${method} ${endpoint} [${statusCode}] ${duration}ms`, {
          method,
          endpoint,
          requestId,
          statusCode,
          duration,
          ...context,
          ...additional,
        })
      },
      error: (error: Error, statusCode?: number, additional?: LogContext) => {
        const duration = Date.now() - start
        this.error(`API Error: ${method} ${endpoint} [${statusCode || 500}] ${duration}ms`, {
          method,
          endpoint,
          requestId,
          statusCode: statusCode || 500,
          duration,
          error: error.message,
          stack: error.stack,
          ...context,
          ...additional,
        })
      },
    }
  }

  /**
   * Database query logger with performance tracking
   */
  dbQuery(operation: string, query: string, params?: unknown[]) {
    const start = Date.now()
    const queryId = Math.random().toString(36).substring(7)

    this.debug(`DB Query: ${operation}`, {
      operation,
      query: query.substring(0, 200),
      params,
      queryId,
    })

    return {
      success: (rowCount?: number, additional?: LogContext) => {
        const duration = Date.now() - start

        if (duration > 1000) {
          this.warn(`Slow query: ${operation} (${duration}ms)`, {
            operation,
            queryId,
            duration,
            rowCount,
            ...additional,
          })
        } else {
          this.debug(`DB Query completed: ${operation} (${duration}ms)`, {
            operation,
            queryId,
            duration,
            rowCount,
            ...additional,
          })
        }
      },
      error: (error: Error, additional?: LogContext) => {
        const duration = Date.now() - start
        this.error(`DB Query failed: ${operation}`, {
          operation,
          queryId,
          duration,
          error: error.message,
          query: query.substring(0, 200),
          ...additional,
        })
      },
    }
  }

  /**
   * External API call logger (Apify, Apollo, etc.)
   */
  externalAPI(service: string, operation: string, context?: LogContext) {
    const start = Date.now()
    const callId = Math.random().toString(36).substring(7)

    this.info(`External API Call: ${service}.${operation}`, {
      service,
      operation,
      callId,
      ...context,
    })

    return {
      success: (response?: unknown, cost?: number) => {
        const duration = Date.now() - start
        this.info(
          `External API Success: ${service}.${operation} (${duration}ms)${cost ? ` [$${cost}]` : ''}`,
          {
            service,
            operation,
            callId,
            duration,
            cost,
            hasResponse: !!response,
          }
        )
      },
      error: (error: Error, cost?: number) => {
        const duration = Date.now() - start
        this.error(`External API Error: ${service}.${operation} (${duration}ms)`, {
          service,
          operation,
          callId,
          duration,
          cost,
          error: error.message,
        })
      },
    }
  }

  /**
   * Cost tracking logger
   */
  cost(service: string, operation: string, cost: number, savings?: number, context?: LogContext) {
    this.info(
      `💰 ${service}.${operation}: $${cost.toFixed(4)}${savings ? ` (saved $${savings.toFixed(4)})` : ''}`,
      {
        service,
        operation,
        cost,
        savings,
        type: 'cost',
        ...context,
      }
    )
  }
}

/**
 * Child logger that includes persistent context in all logs
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private persistentContext: LogContext
  ) {}

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, { ...this.persistentContext, ...context })
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, { ...this.persistentContext, ...context })
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, { ...this.persistentContext, ...context })
  }

  error(message: string, context?: LogContext): void {
    this.parent.error(message, { ...this.persistentContext, ...context })
  }

  time(operation: string, context?: LogContext) {
    return this.parent.time(operation, { ...this.persistentContext, ...context })
  }

  apiRequest(method: string, endpoint: string, context?: LogContext) {
    return this.parent.apiRequest(method, endpoint, { ...this.persistentContext, ...context })
  }

  dbQuery(operation: string, query: string, params?: unknown[]) {
    return this.parent.dbQuery(operation, query, params)
  }

  externalAPI(service: string, operation: string, context?: LogContext) {
    return this.parent.externalAPI(service, operation, { ...this.persistentContext, ...context })
  }

  cost(service: string, operation: string, cost: number, savings?: number, context?: LogContext) {
    this.parent.cost(service, operation, cost, savings, { ...this.persistentContext, ...context })
  }
}

// Export singleton instance
export const logger = new Logger()

// Export types for use in other files
export type { LogLevel, LogContext }
