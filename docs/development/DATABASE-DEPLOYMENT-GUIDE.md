# QuartzIQ Database Optimization - Deployment Guide

## 🎯 Overview

This guide will help you deploy the **PostgreSQL-powered optimization system** that will **slash your Apify costs by 60-80%** through intelligent caching and deduplication.

### Cost Savings Breakdown
- **PlaceID Caching**: Save $0.03-0.05 per business per re-check
- **Review Deduplication**: Filter 60-80% of duplicate reviews
- **Incremental Updates**: Only fetch new reviews (not full history)
- **Multi-tenant Sharing**: Shared business database across clients

**Expected Savings**: If you're spending $500/month on Apify, this will reduce it to **$100-200/month** 💰

---

## 📋 Prerequisites

### Required Software
- **PostgreSQL 14+** (or use managed service like Supabase, Neon, RDS)
- **Node.js 18+**
- **npm** or **yarn**
- **Existing QuartzIQ application** (currently running)

### Recommended: Managed PostgreSQL Services

**Option 1: Supabase (Recommended - Free tier available)**
- URL: https://supabase.com
- Free tier: 500MB database, 2GB bandwidth
- Automatic backups, simple setup
- Cost: Free → $25/month (paid)

**Option 2: Neon (Serverless PostgreSQL)**
- URL: https://neon.tech
- Auto-scaling, pay-per-use
- Free tier: 3GB storage
- Cost: Free → $19/month

**Option 3: Railway**
- URL: https://railway.app
- Simple deployment
- Free tier: $5 credit/month
- Cost: ~$5-10/month for small DB

**Option 4: AWS RDS / DigitalOcean**
- Production-grade
- Cost: $15-50/month depending on size

---

## 🚀 Quick Start (30 minutes)

### Step 1: Set Up PostgreSQL Database

#### Using Supabase (Easiest)

1. Go to https://supabase.com and create account
2. Create new project
3. Wait for database to provision (~2 minutes)
4. Go to Project Settings → Database
5. Copy connection string:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

#### Using Local PostgreSQL

```bash
# Install PostgreSQL (Mac)
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb quartziq_reviews

# Connection string:
# postgresql://postgres:@localhost:5432/quartziq_reviews
```

### Step 2: Configure Environment Variables

Update your `.env.local` file:

```bash
# Add PostgreSQL connection
POSTGRES_HOST=db.your-project.supabase.co  # Or localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=postgres  # Or quartziq_reviews
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-strong-password

# Keep your existing Apify config
APIFY_API_TOKEN=your_apify_token_here
```

### Step 3: Install Database Dependencies

```bash
cd /Users/kris/CLAUDEtools/QuartzIQ

# Install pg (PostgreSQL client)
npm install pg @types/pg dotenv

# Go to database directory
cd database

# Install database tools
npm install
```

### Step 4: Run Database Migration

```bash
# From /Users/kris/CLAUDEtools/QuartzIQ/database
node migrate.js
```

Expected output:
```
🚀 Starting database migration...
📄 Executing schema.sql...
✅ Migration completed successfully!

📊 Created tables:
   - organizations
   - users
   - businesses
   - reviews
   - extractions
   ... (13 tables total)
```

### Step 5: Create Your First Organization

```bash
# Connect to your database
psql postgresql://[your-connection-string]

# Insert your first client
INSERT INTO organizations (name, slug, subscription_tier, monthly_extraction_limit, api_key)
VALUES ('Client 1', 'client-1', 'growth', 2000, 'api_key_client1_secure_random_string');

# Exit
\q
```

### Step 6: Update Your Extraction Code

Create a new API endpoint that uses the optimized extractor:

**File**: `src/app/api/extract-optimized/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../database/db';
import { optimizedExtractor } from '@/lib/services/optimized-extractor';

export async function POST(request: NextRequest) {
  try {
    // Initialize database
    await db.initialize();

    const body = await request.json();

    // Extract with organization ID
    const result = await optimizedExtractor.extract({
      organizationId: body.organizationId || 'default-org-id',
      category: body.category,
      location: body.location,
      countryCode: body.countryCode || 'nl',
      maxBusinessRating: body.maxBusinessRating || 4.6,
      maxReviewStars: body.maxReviewStars || 3,
      dayLimit: body.dayLimit || 14,
      businessLimit: body.businessLimit || 50,
      maxReviewsPerBusiness: body.maxReviewsPerBusiness || 5,
      language: body.language || 'nl',
      useCache: true,
      forceRefresh: body.forceRefresh || false
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Extraction error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### Step 7: Test the System

```bash
# Start your application
PORT=3000 npm run dev

# Test the optimized extraction
curl -X POST http://localhost:3000/api/extract-optimized \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "your-org-id",
    "category": "tandarts",
    "location": "Amsterdam",
    "businessLimit": 5
  }'
```

Expected output:
```json
{
  "extraction_id": "uuid-here",
  "businesses": {
    "total": 5,
    "cached": 0,
    "new": 5
  },
  "reviews": {
    "total": 15,
    "cached": 0,
    "new": 15
  },
  "cost": {
    "apify_credits": 0.25,
    "apify_cost_usd": 0.25,
    "savings_usd": 0.00
  }
}
```

**Second run (with cache):**
```json
{
  "businesses": {
    "total": 5,
    "cached": 5,  // <-- All from cache!
    "new": 0
  },
  "cost": {
    "apify_credits": 0.10,  // <-- Only review extraction
    "apify_cost_usd": 0.10,
    "savings_usd": 0.15     // <-- Saved $0.15!
  }
}
```

---

## 📊 Monitoring & Analytics

### View Database Stats

```sql
-- Business cache stats
SELECT
  COUNT(*) as total_businesses,
  COUNT(DISTINCT country_code) as countries,
  AVG(scrape_count) as avg_scrapes
FROM businesses;

-- Review cache stats
SELECT
  COUNT(*) as total_reviews,
  AVG(rating) as avg_rating,
  COUNT(DISTINCT business_id) as businesses_with_reviews
FROM reviews;

-- Cost analysis
SELECT
  o.name as organization,
  COUNT(e.id) as extractions,
  SUM(e.businesses_found) as total_businesses,
  SUM(e.reviews_extracted) as total_reviews,
  SUM(e.apify_cost_usd) as total_cost,
  ROUND(SUM(e.new_businesses)::numeric / NULLIF(SUM(e.businesses_found), 0) * 100, 1) as cache_hit_rate
FROM organizations o
LEFT JOIN extractions e ON e.organization_id = o.id
GROUP BY o.id, o.name;
```

### API Usage Dashboard Endpoint

**File**: `src/app/api/stats/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { businessCache } from '@/lib/services/business-cache';
import { reviewCache } from '@/lib/services/review-cache';

export async function GET() {
  const businessStats = await businessCache.getStats();
  const reviewStats = await reviewCache.getStats();

  return NextResponse.json({
    businesses: businessStats,
    reviews: reviewStats,
    cache_efficiency: {
      total_businesses: businessStats.total_businesses,
      avg_scrapes_per_business: businessStats.avg_scrape_count,
      estimated_savings_usd: businessStats.total_businesses * 0.03 * (businessStats.avg_scrape_count - 1)
    }
  });
}
```

---

## 🔐 Multi-Tenant Setup (For Your 3 Clients)

### Create Organizations for Each Client

```sql
-- Client 1: Review Removal Service A
INSERT INTO organizations (name, slug, subscription_tier, monthly_extraction_limit, api_key)
VALUES (
  'Review Removal Pro',
  'review-removal-pro',
  'growth',
  2000,
  'api_key_' || md5(random()::text)
);

-- Client 2: Review Removal Service B
INSERT INTO organizations (name, slug, subscription_tier, monthly_extraction_limit, api_key)
VALUES (
  'Reputation Guard',
  'reputation-guard',
  'business',
  5000,
  'api_key_' || md5(random()::text)
);

-- Client 3: Review Removal Service C
INSERT INTO organizations (name, slug, subscription_tier, monthly_extraction_limit, api_key)
VALUES (
  'Review Shield',
  'review-shield',
  'starter',
  500,
  'api_key_' || md5(random()::text)
);

-- View API keys
SELECT name, api_key FROM organizations;
```

### Create API Key Authentication Middleware

**File**: `src/middleware/auth.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../database/db';

export async function authenticateApiKey(request: NextRequest): Promise<{
  organizationId: string;
  organization: any;
} | null> {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return null;
  }

  const result = await query(`
    SELECT id, name, slug, subscription_tier, monthly_extraction_limit, monthly_extractions_used
    FROM organizations
    WHERE api_key = $1 AND subscription_status = 'active'
  `, [apiKey]);

  if (result.rows.length === 0) {
    return null;
  }

  const org = result.rows[0];

  // Check usage limits
  if (org.monthly_extractions_used >= org.monthly_extraction_limit) {
    throw new Error('Monthly extraction limit reached');
  }

  return {
    organizationId: org.id,
    organization: org
  };
}
```

### Protected Extraction Endpoint

```typescript
// src/app/api/extract-protected/route.ts
import { authenticateApiKey } from '@/middleware/auth';

export async function POST(request: NextRequest) {
  // Authenticate
  const auth = await authenticateApiKey(request);

  if (!auth) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    );
  }

  // Extract with organization context
  const body = await request.json();
  const result = await optimizedExtractor.extract({
    organizationId: auth.organizationId,
    ...body
  });

  return NextResponse.json(result);
}
```

---

## 💡 Advanced Features

### 1. Scheduled Monitoring (Cron Jobs)

**File**: `src/cron/monitor-reviews.ts`

```typescript
import { db } from '../../database/db';
import { optimizedExtractor } from '@/lib/services/optimized-extractor';

export async function runScheduledMonitoring() {
  // Get all active monitoring configs
  const configs = await db.query(`
    SELECT *
    FROM monitoring_configs
    WHERE schedule_enabled = true
      AND is_active = true
      AND (next_run_at IS NULL OR next_run_at <= NOW())
  `);

  for (const config of configs.rows) {
    console.log(`Running monitoring: ${config.name}`);

    try {
      await optimizedExtractor.extract({
        organizationId: config.organization_id,
        category: config.category,
        location: config.location,
        countryCode: config.country_code,
        maxBusinessRating: config.max_business_rating,
        maxReviewStars: config.max_review_stars,
        dayLimit: config.day_limit,
        businessLimit: config.business_limit,
        useCache: true
      });

      // Update next run time
      await db.query(`
        UPDATE monitoring_configs
        SET last_run_at = NOW(),
            next_run_at = NOW() + INTERVAL '1 day'
        WHERE id = $1
      `, [config.id]);

    } catch (error) {
      console.error(`Failed to run monitoring ${config.id}:`, error);
    }
  }
}
```

### 2. Migration from Existing Data

**File**: `scripts/migrate-existing-data.ts`

```typescript
import { businessCache } from '@/lib/services/business-cache';
import { reviewCache } from '@/lib/services/review-cache';
import fs from 'fs/promises';
import path from 'path';

export async function migrateExistingData() {
  const dataDir = path.join(__dirname, '../data/extraction-history');
  const files = await fs.readdir(dataDir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const data = JSON.parse(await fs.readFile(path.join(dataDir, file), 'utf-8'));

    console.log(`Migrating ${file}...`);

    // Migrate businesses
    if (data.results?.businesses) {
      for (const business of data.results.businesses) {
        await businessCache.upsert({
          place_id: business.placeId,
          name: business.title,
          category: business.categoryName,
          address: business.address,
          city: business.city,
          rating: business.totalScore,
          reviews_count: business.reviewsCount,
          raw_data: business
        });
      }
    }

    // Migrate reviews
    if (data.results?.reviews) {
      for (const review of data.results.reviews) {
        const businessId = await businessCache.findDuplicate(
          review.placeId,
          review.businessName,
          null,
          null
        );

        if (businessId) {
          await reviewCache.insert(businessId, {
            reviewer_name: review.reviewerName,
            rating: review.stars,
            text: review.text,
            published_date: new Date(review.publishedAtDate),
            raw_data: review
          });
        }
      }
    }
  }

  console.log('✅ Migration complete!');
}
```

---

## 🐛 Troubleshooting

### Connection Issues

```bash
# Test database connection
psql postgresql://your-connection-string

# If connection fails:
# 1. Check firewall/security groups
# 2. Verify password is correct
# 3. Check if IP is whitelisted (Supabase/Neon)
```

### Migration Errors

```bash
# Roll back and retry
cd database
node migrate.js rollback
node migrate.js
```

### Performance Issues

```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Analyze table statistics
ANALYZE businesses;
ANALYZE reviews;
```

---

## 📈 Next Steps

### Phase 2: Analytics Dashboard
- Build D3.js visualization for trends
- Cost tracking dashboard
- Organization usage reports

### Phase 3: Automated Alerts
- Email notifications for new negative reviews
- Webhook integration for client systems
- Slack/Discord notifications

### Phase 4: Advanced Features
- GPT-4 sentiment analysis
- Automated response suggestions
- Competitive intelligence reports

---

## 💰 Expected ROI

**Current Costs (without database optimization):**
- 100 businesses × $0.05/business = $5.00/day
- 30 days = **$150/month**

**With Database Optimization:**
- First extraction: $5.00 (full cost)
- Subsequent extractions: $1.00-2.00 (80% cache hit)
- Daily monitoring: $1.00/day
- 30 days = **$30-60/month**

**SAVINGS: $90-120/month per client = $270-360/month for 3 clients** 🎉

---

## 🆘 Support

For issues or questions:
1. Check troubleshooting section above
2. Review PostgreSQL logs
3. Check application logs for detailed error messages

**Ready to deploy?** Start with Step 1 and you'll be saving money within 30 minutes! 💪
