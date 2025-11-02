/**
 * React Error Boundary Components
 *
 * Catches React rendering errors and displays fallback UI
 * Prevents the entire app from crashing due to component errors
 *
 * Usage:
 *   <ErrorBoundary fallback={<ErrorFallback />}>
 *     <YourComponent />
 *   </ErrorBoundary>
 */

'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Error Boundary Class Component
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught an error:', error, errorInfo)
    }

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    })

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // TODO: Send to error monitoring service (Sentry, etc.)
    // Example:
    // Sentry.captureException(error, {
    //   contexts: {
    //     react: {
    //       componentStack: errorInfo.componentStack,
    //     },
    //   },
    // })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}

/**
 * Default Error Fallback Component
 */
interface DefaultErrorFallbackProps {
  error: Error | null
  errorInfo: React.ErrorInfo | null
  onReset: () => void
}

function DefaultErrorFallback({ error, errorInfo, onReset }: DefaultErrorFallbackProps) {
  const isDevelopment = process.env.NODE_ENV === 'development'

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
      <Card className="max-w-2xl w-full p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Icon */}
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Oops! Something went wrong</h1>
            <p className="text-muted-foreground">
              We encountered an unexpected error while rendering this page.
            </p>
          </div>

          {/* Error Message (Development Only) */}
          {isDevelopment && error && (
            <div className="w-full">
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-left">
                <h3 className="font-semibold text-destructive mb-2">Error Details:</h3>
                <p className="text-sm font-mono text-destructive/80">{error.toString()}</p>

                {errorInfo?.componentStack && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-destructive hover:text-destructive/80">
                      Component Stack
                    </summary>
                    <pre className="mt-2 text-xs overflow-x-auto text-destructive/70">
                      {errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button onClick={onReset} variant="default" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button
              onClick={() => (window.location.href = '/')}
              variant="outline"
              className="gap-2"
            >
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </div>

          {/* Support Message */}
          <p className="text-sm text-muted-foreground">
            If this problem persists, please contact support with the error details above.
          </p>
        </div>
      </Card>
    </div>
  )
}

/**
 * Compact Error Fallback for inline components
 */
export function CompactErrorFallback({ error, onReset }: { error?: Error; onReset?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 border border-destructive/20 bg-destructive/5 rounded-lg">
      <AlertTriangle className="w-8 h-8 text-destructive mb-3" />
      <h3 className="font-semibold text-destructive mb-2">Component Error</h3>
      <p className="text-sm text-muted-foreground text-center mb-4">
        {error?.message || 'This component failed to render'}
      </p>
      {onReset && (
        <Button onClick={onReset} size="sm" variant="outline">
          <RefreshCw className="w-3 h-3 mr-2" />
          Retry
        </Button>
      )}
    </div>
  )
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
