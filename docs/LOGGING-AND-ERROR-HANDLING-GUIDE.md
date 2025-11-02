# 📋 Logging & Error Handling Guide

## Overview

QuartzIQ now has a professional-grade logging and error handling system with:
- ✅ **Structured logging** with Pino (JSON in production, pretty-print in dev)
- ✅ **Custom error classes** for different failure scenarios
- ✅ **React Error Boundaries** for graceful UI error handling
- ✅ **Automatic performance tracking** for DB queries and API calls
- ✅ **Cost tracking** for external API usage
- ✅ **Error monitoring** integration hooks (Sentry-ready)

---

## 📊 Structured Logging

### Basic Usage

```typescript
import { logger } from '@/lib/logger'

// Simple logging
logger.info('User logged in', { userId: '123', email: 'user@example.com' })
logger.error('Failed to save data', { error: err.message, userId: '123' })
logger.warn('API rate limit approaching', { usage: 95, limit: 100 })
logger.debug('Processing request', { requestData })
```

### Child Loggers (Module-Specific Context)

```typescript
// Create a logger with persistent context
const apolloLogger = logger.child({ module: 'apollo-api' })

apolloLogger.info('Starting enrichment', { businessId: '123' })
// Logs: { module: 'apollo-api', businessId: '123', message: 'Starting enrichment' }
```

### Performance Timing

```typescript
const timer = logger.time('database-query')
// ... perform operation ...
timer.end() // Automatically logs duration, warns if > 5s
```

### API Request Logging

```typescript
const apiLog = logger.apiRequest('POST', '/api/extract')

try {
  const response = await fetch('/api/extract', options)
  apiLog.success(200, { businesses: 50 })
} catch (error) {
  apiLog.error(error, 500)
}
```

### Database Query Logging

```typescript
const queryLog = logger.dbQuery(
  'fetch-businesses',
  'SELECT * FROM businesses WHERE organization_id = $1',
  [orgId]
)

try {
  const result = await db.query(sql, [orgId])
  queryLog.success(result.rowCount)
} catch (error) {
  queryLog.error(error)
}
```

### External API Logging

```typescript
const apiLog = logger.externalAPI('apollo', 'search-executives', { domain: 'example.com' })

try {
  const result = await apolloClient.search(domain)
  apiLog.success(result, 0.10) // Logs with cost
} catch (error) {
  apiLog.error(error, 0.10)
}
```

### Cost Tracking

```typescript
logger.cost('apollo', 'enrichment', 0.15, 0.05, { businessId: '123' })
// Logs: 💰 apollo.enrichment: $0.1500 (saved $0.0500)
```

---

## 🚨 Error Handling

### Custom Error Classes

```typescript
import {
  APIError,
  DatabaseError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  QuotaExceededError,
} from '@/lib/errors'

// Throw specific errors with context
throw new APIError('Apollo API rate limit exceeded', {
  service: 'apollo',
  currentUsage: 105,
  limit: 100,
})

throw new DatabaseError('Failed to insert business', {
  businessId: '123',
  table: 'businesses',
  constraint: 'unique_place_id',
})

throw new ValidationError('Invalid email format', {
  field: 'email',
  value: 'invalid-email',
})

throw new NotFoundError('Business', { placeId: 'ChIJ123' })

throw new QuotaExceededError('Apify', 1000, { organization: 'client-1' })
```

### API Route Error Handling

#### Option 1: Async Handler Wrapper (Recommended)

```typescript
import { asyncHandler } from '@/lib/errors/error-handler'
import { NextResponse } from 'next/server'

export const POST = asyncHandler(async (req) => {
  // Your logic here - errors are automatically caught and formatted
  const data = await someOperation()
  return NextResponse.json({ success: true, data })
})
```

#### Option 2: Manual Error Handling

```typescript
import { handleAPIError } from '@/lib/errors/error-handler'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const data = await someOperation()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return handleAPIError(error, req)
  }
}
```

### Retry Logic

```typescript
import { retry } from '@/lib/errors/error-handler'

const result = await retry(
  async () => {
    return await fetchDataFromExternalAPI()
  },
  {
    maxAttempts: 3,
    delay: 1000,
    backoff: 2, // Exponential backoff
    onRetry: (attempt, error) => {
      logger.warn(`Retry attempt ${attempt}`, { error: error.message })
    },
  }
)
```

### Error Assertions

```typescript
import { assert } from '@/lib/errors/error-handler'
import { ValidationError } from '@/lib/errors'

// Assert condition or throw
assert(email.includes('@'), 'Invalid email format', ValidationError, { email })
```

---

## ⚛️ React Error Boundaries

### Wrapping Components

```typescript
import { ErrorBoundary } from '@/components/errors/error-boundary'

function MyPage() {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <MyComponent />
    </ErrorBoundary>
  )
}
```

### With Custom Error Handler

```typescript
<ErrorBoundary
  onError={(error, errorInfo) => {
    logger.error('Component error', {
      error: error.message,
      componentStack: errorInfo.componentStack,
    })
    // Send to monitoring service
  }}
>
  <MyComponent />
</ErrorBoundary>
```

### HOC Pattern

```typescript
import { withErrorBoundary } from '@/components/errors/error-boundary'

const SafeComponent = withErrorBoundary(MyComponent, <ErrorFallback />)
```

### Compact Error Boundary (for inline components)

```typescript
import { CompactErrorFallback } from '@/components/errors/error-boundary'

<ErrorBoundary fallback={<CompactErrorFallback />}>
  <SmallWidget />
</ErrorBoundary>
```

---

## 🔄 Migration Guide

### Replacing console.log

**Before:**
```typescript
console.log('User logged in:', userId)
console.error('API failed:', error)
console.warn('Quota almost exceeded')
```

**After:**
```typescript
logger.info('User logged in', { userId })
logger.error('API failed', { error: error.message })
logger.warn('Quota almost exceeded', { usage, limit })
```

### Replacing try-catch blocks in API routes

**Before:**
```typescript
export async function POST(req: NextRequest) {
  try {
    const data = await db.query(sql)
    return NextResponse.json({ data })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**After:**
```typescript
import { asyncHandler } from '@/lib/errors/error-handler'
import { DatabaseError } from '@/lib/errors'

export const POST = asyncHandler(async (req) => {
  const data = await db.query(sql)
  if (!data) {
    throw new DatabaseError('No data found', { query: sql })
  }
  return NextResponse.json({ data })
})
```

### Updating Database Queries

**Before:**
```typescript
try {
  const result = await db.query(sql, params)
  console.log(`Query returned ${result.rowCount} rows`)
} catch (error) {
  console.error('Database error:', error)
  throw error
}
```

**After:**
```typescript
// Database module automatically logs with structured logger
const result = await db.query(sql, params)
// Logs automatically include: operation, duration, row count, slow query warnings
```

---

## 📈 Production Monitoring

### Environment Variables

```bash
# Set log level
LOG_LEVEL=info  # debug | info | warn | error

# Production
NODE_ENV=production  # JSON structured logs

# Development
NODE_ENV=development  # Pretty-printed colorized logs
```

### Sentry Integration (TODO)

```typescript
// In lib/logger.ts reportError method
if (process.env.SENTRY_DSN) {
  Sentry.captureException(error, {
    extra: context,
  })
}
```

### Log Aggregation

In production, Pino outputs JSON which can be piped to:
- **Datadog**: `pm2 start app.js | datadog-agent`
- **Elasticsearch**: Use Filebeat or Logstash
- **CloudWatch**: Use AWS CloudWatch agent
- **Logtail**: Direct JSON log shipping

---

## 🎯 Best Practices

### 1. Use Appropriate Log Levels

```typescript
logger.debug('Detailed diagnostic info')  // Development only
logger.info('Normal operations')          // Business events
logger.warn('Degraded state, but working') // Attention needed
logger.error('Operation failed')          // Requires action
```

### 2. Include Context, Not Just Messages

```typescript
// ❌ Bad
logger.error('Failed')

// ✅ Good
logger.error('Failed to enrich business', {
  businessId: '123',
  service: 'apollo',
  error: err.message,
  retryCount: 3,
})
```

### 3. Use Child Loggers for Modules

```typescript
// At the top of your module
const moduleLogger = logger.child({ module: 'apollo-enrichment' })

// All logs from this module will include { module: 'apollo-enrichment' }
moduleLogger.info('Starting enrichment')
```

### 4. Log Business Events, Not Implementation Details

```typescript
// ✅ Good
logger.info('Lead generated', { businessId, source: 'google-maps', category: 'dentist' })
logger.cost('apollo', 'enrichment', 0.15, 0.05, { businessId })

// ❌ Less useful
logger.info('Loop iteration 5')
logger.info('Variable assigned')
```

### 5. Use Structured Errors

```typescript
// ✅ Good
throw new QuotaExceededError('Apollo', 100, {
  organization: 'client-1',
  currentUsage: 105
})

// ❌ Less useful
throw new Error('Quota exceeded')
```

---

## 📊 Example: Complete API Route

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { asyncHandler } from '@/lib/errors/error-handler'
import { logger } from '@/lib/logger'
import { APIError, ValidationError, QuotaExceededError } from '@/lib/errors'
import { db } from '@/database/db'

const routeLogger = logger.child({ module: 'extract-api' })

export const POST = asyncHandler(async (req: NextRequest) => {
  const timer = routeLogger.time('extraction-request')

  // Parse and validate
  const body = await req.json()
  if (!body.category) {
    throw new ValidationError('Category is required', { body })
  }

  // Check quota
  const usage = await checkQuota(body.organizationId)
  if (usage.exceeded) {
    throw new QuotaExceededError('Extraction', usage.limit, {
      organization: body.organizationId,
      currentUsage: usage.current,
    })
  }

  // Log business event
  routeLogger.info('Starting extraction', {
    category: body.category,
    location: body.location,
    businessLimit: body.businessLimit,
  })

  // Perform extraction with external API logging
  const apiLog = routeLogger.externalAPI('apify', 'google-maps-scraper', {
    category: body.category,
  })

  try {
    const results = await runApifyCrawl(body)
    apiLog.success(results, results.cost)

    // Log cost
    routeLogger.cost('apify', 'extraction', results.cost, results.savings)

    timer.end()

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error) {
    apiLog.error(error as Error)
    throw new APIError('Apify extraction failed', {
      category: body.category,
      error: (error as Error).message,
    })
  }
})
```

---

## 🔍 Debugging

### View Logs in Development

Logs are automatically colorized and pretty-printed in development:

```
[14:23:45] 📊 INFO: Starting extraction { category: 'dentist', location: 'Amsterdam' }
[14:23:47] 💰 INFO: apollo.enrichment: $0.1500 (saved $0.0500)
[14:23:49] ✅ INFO: Completed extraction-request (4230ms)
```

### View Logs in Production

JSON structured logs for machine parsing:

```json
{
  "level": "info",
  "time": "2025-01-26T14:23:45.123Z",
  "module": "extract-api",
  "category": "dentist",
  "location": "Amsterdam",
  "msg": "Starting extraction"
}
```

### Search Logs

```bash
# Find all Apollo API calls
cat logs.json | jq 'select(.service == "apollo")'

# Find errors only
cat logs.json | jq 'select(.level == "error")'

# Find slow operations
cat logs.json | jq 'select(.duration > 5000)'
```

---

## ✅ Quick Checklist

- [ ] Replace all `console.log` with `logger.info`
- [ ] Replace all `console.error` with `logger.error`
- [ ] Wrap API routes with `asyncHandler`
- [ ] Use custom error classes instead of generic `Error`
- [ ] Add Error Boundaries to React components
- [ ] Use child loggers for modules
- [ ] Log business events with context
- [ ] Track costs for external APIs
- [ ] Set `LOG_LEVEL` environment variable

---

**Questions?** See example implementations in:
- Database: `/database/db.ts`
- API Route: `/src/app/api/extract-optimized/route.ts` (next to update)
- React Component: `/src/app/layout.tsx` (add ErrorBoundary)
