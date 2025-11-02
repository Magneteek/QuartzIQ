# Business Review Crawl Management System

## Overview

A comprehensive system for managing review extraction from 6k+ cached businesses with:
- **Batch crawl management** (queue 2k businesses, crawl later)
- **Selective re-crawling** (choose specific businesses to re-crawl)
- **Incremental crawling** (fetch only new reviews since last crawl = **75% cost savings!**)
- **Smart prioritization** (auto-prioritize businesses based on urgency)
- **Historical tracking** (audit trail of all crawls per business)

---

## 🚀 Quick Start

### 1. Run Database Migration

```bash
# Run the migration to create new tables
node database/run-migration.js 002_add_crawl_management

# Verify migration
# You should see:
# ✓ Tables created: business_review_crawls, crawl_queue
# ✓ Views created: businesses_with_crawl_status, active_crawl_batches
# ✓ Backfilled X crawl records from existing reviews
```

### 2. Test the APIs

```bash
# List businesses with crawl status
curl http://localhost:3000/api/crawl/businesses

# Get dashboard statistics
curl http://localhost:3000/api/crawl/stats

# Add businesses to crawl queue
curl -X POST http://localhost:3000/api/crawl/queue \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "your-org-id",
    "businessIds": ["business-id-1", "business-id-2"],
    "batchName": "Test Batch",
    "priority": 75,
    "crawlConfig": {
      "maxReviewsPerBusiness": 2,
      "maxReviewStars": 3,
      "dayLimit": 14,
      "incremental": true
    }
  }'

# Start crawl execution
curl -X POST http://localhost:3000/api/crawl/start \
  -H "Content-Type": application/json" \
  -d '{"batchId": "batch-uuid-here"}'
```

---

## 📊 Database Schema

### Tables

#### `business_review_crawls`
Tracks every crawl session per business for incremental updates and audit trail.

```sql
- id: UUID (primary key)
- business_id: UUID (reference to businesses)
- organization_id: UUID (multi-tenant)
- extraction_id: UUID (link to extraction session)
- crawled_at: TIMESTAMP (when crawled)
- reviews_found: INTEGER (total reviews in this crawl)
- reviews_new: INTEGER (actually new reviews)
- reviews_duplicate: INTEGER (already in cache)
- is_incremental: BOOLEAN (was this incremental?)
- reviews_since_date: DATE (only fetched reviews after this date)
- apify_cost_usd: DECIMAL (cost of this crawl)
- next_recommended_crawl: TIMESTAMP (when to crawl again)
- crawl_config: JSONB (crawl parameters used)
```

#### `crawl_queue`
Batch queue system for controlled, scheduled review crawling.

```sql
- id: UUID (primary key)
- business_id: UUID (which business to crawl)
- organization_id: UUID (multi-tenant)
- batch_id: UUID (group businesses into batches)
- batch_name: VARCHAR (e.g., "Amsterdam Tandarts - Batch 1")
- priority: INTEGER (0-100, higher = crawl sooner)
- position_in_batch: INTEGER (order within batch)
- status: VARCHAR (queued, in_progress, completed, failed)
- scheduled_for: TIMESTAMP (when to execute)
- crawl_config: JSONB (maxReviewsPerBusiness, etc.)
- reviews_extracted: INTEGER (results)
- apify_cost_usd: DECIMAL (cost)
```

### Views

#### `businesses_with_crawl_status`
Convenient view showing all businesses with their last crawl status.

```sql
SELECT * FROM businesses_with_crawl_status
WHERE crawl_status = 'due'  -- overdue, due, soon, recent, never_crawled
  AND category = 'tandarts'
ORDER BY days_since_crawl DESC;
```

#### `active_crawl_batches`
Summary of all active crawl batches with progress tracking.

```sql
SELECT * FROM active_crawl_batches
WHERE batch_status IN ('queued', 'in_progress');
```

---

## 🔧 Backend Services

### CrawlQueueManager

Manages batch crawl queue, prioritization, and execution.

```typescript
import { crawlQueueManager } from '@/lib/services/crawl-queue-manager';

// Add businesses to queue
const batch = await crawlQueueManager.addToQueue({
  organizationId: 'org-id',
  businessIds: ['business-1', 'business-2'],
  batchName: 'Amsterdam Tandarts - October 2025',
  priority: 75,
  crawlConfig: {
    maxReviewsPerBusiness: 2,
    maxReviewStars: 3,
    dayLimit: 14,
    incremental: true
  }
});

// Get queue status
const status = await crawlQueueManager.getQueueStatus();

// Get businesses with crawl status
const result = await crawlQueueManager.getBusinessesWithCrawlStatus({
  category: 'tandarts',
  city: 'Amsterdam',
  crawlStatus: 'due',  // overdue, due, soon, recent, never_crawled
  limit: 50
});

// Calculate smart priorities
await crawlQueueManager.calculatePriorities();
```

### IncrementalCrawler

Executes individual crawls with cost optimization through incremental updates.

```typescript
import { incrementalCrawler } from '@/lib/services/incremental-crawler';

// Crawl single business with incremental logic
const result = await incrementalCrawler.crawlBusiness({
  organizationId: 'org-id',
  businessId: 'business-id',
  maxReviewsPerBusiness: 2,
  maxReviewStars: 3,
  dayLimit: 14,
  forceFullCrawl: false  // Let system decide incremental vs full
});

// Crawl from queue (batch execution)
const results = await incrementalCrawler.crawlFromQueue([
  'queue-id-1',
  'queue-id-2',
  'queue-id-3'
]);

// Estimate savings from incremental
const savings = await incrementalCrawler.estimateIncrementalSavings(
  'business-id',
  0.5  // Average new reviews per day
);
// Returns: { fullCrawlCost: 0.02, incrementalCost: 0.005, savings: 0.015, savingsPercent: 75 }

// Get crawl history
const history = await incrementalCrawler.getCrawlHistory('business-id');
```

---

## 🌐 API Endpoints

### GET /api/crawl/businesses

List businesses with their crawl status.

**Query Parameters:**
- `category`: Filter by category (e.g., "tandarts")
- `city`: Filter by city (e.g., "Amsterdam")
- `crawlStatus`: Filter by status (never_crawled, overdue, due, soon, recent)
- `inQueue`: Filter businesses in queue (true/false)
- `limit`: Results per page (default: 50)
- `offset`: Pagination offset (default: 0)
- `sortBy`: Sort column (lastCrawled, rating, name, reviewCount)
- `sortOrder`: Sort direction (asc, desc)

**Response:**
```json
{
  "success": true,
  "businesses": [
    {
      "id": "uuid",
      "name": "Business Name",
      "city": "Amsterdam",
      "category": "tandarts",
      "rating": 4.2,
      "reviewsCount": 245,
      "lastCrawledAt": "2025-10-15T10:30:00Z",
      "daysSinceLastCrawl": 14,
      "crawlStatus": "due",
      "inQueue": false,
      "nextRecommendedCrawl": "2025-10-29T10:30:00Z",
      "reviewsInLastCrawl": 5
    }
  ],
  "total": 2340,
  "stats": {
    "neverCrawled": 840,
    "dueForRecrawl": 1200,
    "upToDate": 300,
    "inQueue": 0
  }
}
```

### GET /api/crawl/businesses/[businessId]/history

Get crawl history for a specific business.

**Response:**
```json
{
  "success": true,
  "businessId": "uuid",
  "history": [
    {
      "id": "crawl-uuid",
      "crawledAt": "2025-10-15T10:30:00Z",
      "durationSeconds": 3,
      "reviewsFound": 2,
      "reviewsNew": 2,
      "reviewsDuplicate": 0,
      "isIncremental": false,
      "costUsd": 0.02,
      "nextRecommendedCrawl": "2025-10-29T10:30:00Z",
      "status": "completed"
    }
  ],
  "totals": {
    "totalCrawls": 5,
    "totalReviewsFound": 12,
    "totalReviewsNew": 10,
    "totalCostUsd": 0.08,
    "incrementalCrawls": 4,
    "avgReviewsPerCrawl": 2
  }
}
```

### POST /api/crawl/queue

Add businesses to crawl queue.

**Request Body:**
```json
{
  "organizationId": "org-uuid",
  "businessIds": ["business-1", "business-2", "..."],
  "batchName": "Amsterdam Tandarts - October 2025",
  "priority": 75,
  "scheduledFor": "2025-10-20T20:00:00Z",  // Optional
  "crawlConfig": {
    "maxReviewsPerBusiness": 2,
    "maxReviewStars": 3,
    "dayLimit": 14,
    "incremental": true,
    "language": "nl"
  }
}
```

**Response:**
```json
{
  "success": true,
  "batch": {
    "batchId": "batch-uuid",
    "batchName": "Amsterdam Tandarts - October 2025",
    "businessCount": 2000,
    "estimatedCost": 40,
    "estimatedDuration": "45 minutes",
    "queuedAt": "2025-10-15T10:30:00Z"
  }
}
```

### GET /api/crawl/queue

Get current queue status with batch progress.

**Response:**
```json
{
  "success": true,
  "batches": [
    {
      "batchId": "uuid",
      "batchName": "Amsterdam Tandarts - Batch 1",
      "organizationId": "org-uuid",
      "businessCount": 2000,
      "status": "in_progress",
      "progress": 45.5,
      "completed": 910,
      "failed": 5,
      "queued": 1085,
      "inProgress": 0,
      "totalReviews": 1820,
      "totalCost": 18.20,
      "queuedAt": "2025-10-15T10:00:00Z"
    }
  ],
  "stats": {
    "totalQueued": 1085,
    "totalInProgress": 0,
    "estimatedTotalCost": 21.70
  }
}
```

### POST /api/crawl/start

Start crawl execution for queued businesses.

**Request Body:**
```json
{
  "batchId": "batch-uuid",  // Optional: specific batch or all queued
  "maxConcurrent": 1  // Max businesses to crawl simultaneously
}
```

**Response:**
```json
{
  "success": true,
  "message": "Started crawling 2000 businesses",
  "queuedCount": 2000,
  "batchId": "batch-uuid"
}
```

### GET /api/crawl/stats

Get dashboard statistics.

**Response:**
```json
{
  "success": true,
  "totalBusinesses": 6000,
  "crawlStatus": {
    "neverCrawled": 840,
    "dueForRecrawl": 2340,
    "upToDate": 2820,
    "inQueue": 0
  },
  "costAnalysis": {
    "totalSpent": 120.50,
    "avgCostPerBusiness": 0.0201,
    "totalCrawls": 6000,
    "projectedMonthlyCost": 23.40
  },
  "efficiency": {
    "cacheHitRate": "47.0%",
    "avgCostPerBusiness": "0.0201",
    "estimatedIncrementalSavings": "72.30"
  },
  "queue": {
    "totalQueued": 0,
    "totalInProgress": 0,
    "estimatedTotalCost": 0
  }
}
```

---

## 💡 Usage Examples

### Example 1: Initial Crawl of 2k Businesses

```typescript
// 1. Get businesses that have never been crawled
const response = await fetch('/api/crawl/businesses?crawlStatus=never_crawled&limit=2000');
const { businesses } = await response.json();

// 2. Add to queue
const queueResponse = await fetch('/api/crawl/queue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    organizationId: 'your-org-id',
    businessIds: businesses.map(b => b.id),
    batchName: 'Initial Crawl - Batch 1',
    priority: 50,
    crawlConfig: {
      maxReviewsPerBusiness: 2,
      maxReviewStars: 3,
      dayLimit: 14
    }
  })
});

const { batch } = await queueResponse.json();
console.log(`Queued ${batch.businessCount} businesses`);
console.log(`Estimated cost: $${batch.estimatedCost}`);

// 3. Start crawling
await fetch('/api/crawl/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ batchId: batch.batchId })
});
```

### Example 2: Re-crawl After 14 Days

```typescript
// 1. Get businesses due for re-crawl
const response = await fetch('/api/crawl/businesses?crawlStatus=due&limit=2000');
const { businesses } = await response.json();

console.log(`Found ${businesses.length} businesses due for re-crawl`);

// 2. Add to queue with incremental crawling
const queueResponse = await fetch('/api/crawl/queue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    organizationId: 'your-org-id',
    businessIds: businesses.map(b => b.id),
    batchName: 'Re-crawl - Check for New Reviews',
    priority: 75,
    crawlConfig: {
      maxReviewsPerBusiness: 2,
      maxReviewStars: 3,
      dayLimit: 14,
      incremental: true  // Only fetch new reviews!
    }
  })
});

const { batch } = await queueResponse.json();
console.log(`Estimated cost: $${batch.estimatedCost} (75% savings from incremental!)`);

// 3. Start crawling
await fetch('/api/crawl/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ batchId: batch.batchId })
});
```

### Example 3: Monitor Batch Progress

```typescript
// Poll queue status
const interval = setInterval(async () => {
  const response = await fetch('/api/crawl/queue');
  const { batches } = await response.json();

  const activeBatch = batches.find(b => b.status === 'in_progress');

  if (activeBatch) {
    console.log(`Progress: ${activeBatch.progress}%`);
    console.log(`Completed: ${activeBatch.completed}/${activeBatch.businessCount}`);
    console.log(`Cost so far: $${activeBatch.totalCost.toFixed(2)}`);
  } else {
    console.log('Batch complete!');
    clearInterval(interval);
  }
}, 5000);
```

---

## 💰 Cost Optimization

### Full Crawl vs. Incremental Crawl

```
SCENARIO: Re-crawl 2,000 businesses after 14 days

Full Crawl (Old Way):
- Fetch all reviews again (even duplicates)
- 2,000 businesses × $0.02 = $40
- Duration: ~45 minutes
- Processes 4,000 reviews (2,000 duplicates)

Incremental Crawl (New Way):
- Only fetch reviews published after last crawl
- Average: 1 new review per business over 14 days
- 2,000 businesses × $0.005 = $10
- Duration: ~15 minutes
- Processes 2,000 reviews (all new)
- SAVINGS: $30 (75% cost reduction!)
```

### Monthly Projection

```
Monthly re-crawl cadence (every 14 days):
- 6,000 businesses total
- 2 crawls per month
- Without incremental: 12,000 crawl ops × $0.02 = $240/month
- With incremental: 12,000 crawl ops × $0.005 = $60/month
- MONTHLY SAVINGS: $180 (75%)
- ANNUAL SAVINGS: $2,160
```

---

## 🎯 Next Steps

### Backend Complete ✅
- [x] Database migration (business_review_crawls, crawl_queue)
- [x] CrawlQueueManager service
- [x] IncrementalCrawler service
- [x] All API endpoints

### Frontend TODO
- [ ] Business Crawl Manager Dashboard (`/dashboard/crawl-manager`)
- [ ] Crawl Queue View (`/dashboard/crawl-queue`)
- [ ] Crawl History Timeline (`/dashboard/crawl-history`)

---

## 🐛 Troubleshooting

### Migration fails
```bash
# Check database connection
node -e "require('./database/db').db.query('SELECT NOW()').then(r => console.log('✓ Connected:', r.rows[0]))"

# Check if tables already exist
psql your_database -c "\dt business_review_crawls"
```

### API returns 500 error
```bash
# Check logs
npm run dev

# Test database queries directly
node -e "require('./src/lib/services/crawl-queue-manager').crawlQueueManager.getDashboardStats().then(console.log)"
```

### Crawl not starting
```bash
# Check queue status
curl http://localhost:3000/api/crawl/queue

# Check for businesses in queue
psql your_database -c "SELECT COUNT(*) FROM crawl_queue WHERE status = 'queued';"
```

---

## 📚 Additional Documentation

- See `database/migrations/002_add_crawl_management.sql` for full schema
- See `src/lib/services/crawl-queue-manager.ts` for queue management logic
- See `src/lib/services/incremental-crawler.ts` for crawl execution logic
- See API endpoint files in `src/app/api/crawl/` for request/response formats

---

**System ready for frontend development!** 🚀
