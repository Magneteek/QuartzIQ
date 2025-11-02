# Smart Two-Tier Crawl Strategy

## Overview

This system optimizes crawling costs by separating businesses into two categories:

1. **Primary Crawl Targets**: Businesses WITH reviews (guaranteed data yield)
2. **Secondary Crawl Targets**: Businesses WITHOUT reviews (periodic check for new reviews)

## The Problem

Without smart filtering:
- Crawling 853 businesses with 0 reviews = **$213 wasted** (assuming $0.25/business)
- No guarantee they'll have reviews next month
- Continuous waste on businesses that may never get reviews

## The Solution

### Primary Crawling (Standard Review Extraction)
```
Target: Businesses with reviews_count > 0
Goal: Extract review data immediately
Expected Yield: 100% - all businesses have reviews
Cost: $0.25 per business
ROI: High - guaranteed data extraction
```

### Secondary Crawling (Periodic Review Checks)
```
Target: Businesses with reviews_count = 0
Goal: Detect when they acquire reviews
Check Interval: 30 days (configurable)
Expected Yield: 5-15% - some will gain reviews over time
Cost: $0.25 per check
ROI: Variable - only promotes businesses that gain reviews
```

---

## Database Schema Changes

### New Fields on `businesses` Table

| Field | Type | Purpose |
|-------|------|---------|
| `last_review_check_at` | TIMESTAMP | When we last checked if this 0-review business has reviews |
| `review_check_count` | INTEGER | How many times we've checked this business |
| `had_reviews_on_discovery` | BOOLEAN | Did this business have reviews when first found? |
| `crawl_priority` | VARCHAR(20) | `high`, `medium`, `standard`, or `low` |

### Crawl Priority Tiers

- **High**: 500+ reviews (73 businesses)
- **Medium**: 100-499 reviews (322 businesses)
- **Standard**: 1-99 reviews (2,747 businesses)
- **Low**: 0 reviews (853 businesses)

---

## API Usage

### 1. Get Primary Crawl Targets (Businesses with Reviews)

```bash
# Get top 100 businesses with reviews, prioritized by review count
curl http://localhost:3000/api/crawl/targets?mode=primary&limit=100
```

**Response:**
```json
{
  "success": true,
  "mode": "primary",
  "targets": [
    {
      "place_id": "ChIJsad2C5mEx0cRcxLhPq7lzE0",
      "name": "McDonald's Doetinchem",
      "category": "Hamburgerrestaurant",
      "reviews_count": 5823,
      "rating": 3.6,
      "crawl_priority": "high",
      "days_since_crawl": 45,
      "crawl_status": "stale"
    }
  ],
  "count": 100,
  "stats": {
    "total_with_reviews": 3064,
    "never_crawled": 2156,
    "stale": 908,
    "high_priority": 73,
    "medium_priority": 322
  },
  "recommendations": {
    "message": "Primary crawl targets - businesses with existing reviews",
    "strategy": "Crawl these businesses to extract review data immediately",
    "expectedYield": "Guaranteed review data from all targets"
  }
}
```

### 2. Get Secondary Crawl Targets (0-Review Businesses)

```bash
# Get businesses without reviews that are ready for periodic check
curl http://localhost:3000/api/crawl/targets?mode=secondary&limit=50
```

**Response:**
```json
{
  "success": true,
  "mode": "secondary",
  "targets": [
    {
      "place_id": "ChIJ...",
      "name": "New Dental Practice",
      "category": "Tandarts",
      "reviews_count": 0,
      "last_review_check_at": "2024-09-15T10:30:00Z",
      "review_check_count": 2,
      "days_since_check": 42,
      "check_status": "ready"
    }
  ],
  "count": 50,
  "stats": {
    "total_zero_reviews": 853,
    "never_checked": 320,
    "ready_for_check": 410,
    "overdue_check": 123,
    "avg_check_count": 1.8
  },
  "recommendations": {
    "message": "Secondary crawl targets - checking for new reviews",
    "strategy": "Periodic checks on 0-review businesses to detect when they gain reviews",
    "expectedYield": "Some businesses may have acquired reviews since last check",
    "checkInterval": "30 days recommended"
  }
}
```

### 3. Filter by Category or Location

```bash
# Get dentists in Amsterdam with reviews
curl "http://localhost:3000/api/crawl/targets?mode=primary&category=Tandarts&city=Amsterdam&limit=50"

# Get 0-review physiotherapists ready for check
curl "http://localhost:3000/api/crawl/targets?mode=secondary&category=Fysiotherapeut&limit=50"
```

### 4. Update After Crawling

```bash
# After checking a 0-review business and finding NO new reviews
curl -X POST http://localhost:3000/api/crawl/targets/update \
  -H "Content-Type: application/json" \
  -d '{
    "placeId": "ChIJ...",
    "mode": "secondary",
    "reviewsFound": false
  }'

# After checking a 0-review business and finding NEW reviews!
curl -X POST http://localhost:3000/api/crawl/targets/update \
  -H "Content-Type: application/json" \
  -d '{
    "placeId": "ChIJ...",
    "mode": "secondary",
    "reviewsFound": true
  }'
```

**When `reviewsFound: true`:**
- Business is promoted to primary crawl target
- `crawl_priority` is recalculated based on review count
- Business exits the secondary crawl pool

---

## Workflow Integration

### Daily Crawling Workflow

```javascript
// 1. Get primary targets (businesses with reviews)
const primaryTargets = await fetch(
  'http://localhost:3000/api/crawl/targets?mode=primary&limit=100'
).then(r => r.json())

console.log(`Found ${primaryTargets.count} businesses with reviews to crawl`)

// 2. Crawl each target for reviews
for (const business of primaryTargets.targets) {
  const reviews = await extractReviews(business.place_id)
  console.log(`Extracted ${reviews.length} reviews from ${business.name}`)
}
```

### Monthly Review Check Workflow

```javascript
// 1. Get secondary targets (0-review businesses ready for check)
const secondaryTargets = await fetch(
  'http://localhost:3000/api/crawl/targets?mode=secondary&limit=50'
).then(r => r.json())

console.log(`Found ${secondaryTargets.count} 0-review businesses to check`)

// 2. Check each business for new reviews
for (const business of secondaryTargets.targets) {
  const currentReviewCount = await checkReviewCount(business.place_id)

  if (currentReviewCount > 0) {
    console.log(`🎉 ${business.name} now has ${currentReviewCount} reviews!`)

    // Update database - promote to primary crawl
    await fetch('http://localhost:3000/api/crawl/targets/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeId: business.place_id,
        mode: 'secondary',
        reviewsFound: true
      })
    })

    // Now extract those reviews
    const reviews = await extractReviews(business.place_id)
  } else {
    console.log(`${business.name} still has 0 reviews (check #${business.review_check_count + 1})`)

    // Update check timestamp
    await fetch('http://localhost:3000/api/crawl/targets/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeId: business.place_id,
        mode: 'secondary',
        reviewsFound: false
      })
    })
  }
}
```

---

## Cost Analysis

### Without Smart Crawling
```
Total businesses: 5,795
Crawl all businesses: 5,795 × $0.25 = $1,448.75
Waste on 0-review businesses: 853 × $0.25 = $213.19
Efficiency: 85.3%
```

### With Smart Crawling
```
Primary crawl (businesses with reviews): 3,064 × $0.25 = $766
Secondary crawl (monthly check, 10% conversion): 853 × $0.25 / 12 months = $17.77/month
Annual secondary crawl cost: $213.19/year
Businesses gaining reviews (est. 10%): 85 businesses promoted to primary

Total first year: $766 + $213 = $979
Waste: $0 (all crawls have purpose)
Efficiency: 100%
Savings: $469.75 (32% cost reduction)
```

---

## Implementation Steps

### 1. Run the Migration

```bash
# Apply the smart crawl strategy migration
psql -h your-db-host -U postgres -d quartziq -f database/migrations/004_smart_crawl_strategy.sql
```

### 2. Verify Migration

```sql
-- Check that fields were added
SELECT
  last_review_check_at,
  review_check_count,
  had_reviews_on_discovery,
  crawl_priority
FROM businesses
LIMIT 5;

-- View ready-for-check businesses
SELECT * FROM businesses_ready_for_review_check LIMIT 10;

-- View optimal crawl targets
SELECT * FROM businesses_optimal_crawl_targets LIMIT 10;
```

### 3. Test the API

```bash
# Test primary mode
curl http://localhost:3000/api/crawl/targets?mode=primary&limit=10

# Test secondary mode
curl http://localhost:3000/api/crawl/targets?mode=secondary&limit=10
```

---

## Monitoring & Maintenance

### Key Metrics to Track

1. **Primary Crawl Coverage**
   - % of businesses with reviews that have been crawled
   - Average staleness (days since last crawl)

2. **Secondary Crawl Success Rate**
   - % of 0-review businesses that gain reviews
   - Average time to first review

3. **Cost Efficiency**
   - Cost per review extracted
   - ROI on secondary crawls

### SQL Queries for Monitoring

```sql
-- See secondary crawl success rate
SELECT
  COUNT(*) FILTER (WHERE reviews_count > 0 AND had_reviews_on_discovery = FALSE) as gained_reviews,
  COUNT(*) FILTER (WHERE reviews_count = 0 AND had_reviews_on_discovery = FALSE) as still_zero,
  ROUND(
    COUNT(*) FILTER (WHERE reviews_count > 0 AND had_reviews_on_discovery = FALSE) * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE had_reviews_on_discovery = FALSE), 0),
    2
  ) as conversion_rate_percentage
FROM businesses;

-- See businesses overdue for review check (>60 days)
SELECT
  name,
  category,
  city,
  last_review_check_at,
  EXTRACT(DAY FROM NOW() - last_review_check_at) as days_overdue
FROM businesses
WHERE reviews_count = 0
  AND last_review_check_at < NOW() - INTERVAL '60 days'
ORDER BY last_review_check_at ASC
LIMIT 20;
```

---

## Best Practices

### Primary Crawling
✅ **DO**:
- Prioritize `high` and `medium` priority businesses first
- Crawl never-crawled businesses before stale ones
- Use category/location filters to batch similar businesses

❌ **DON'T**:
- Crawl businesses with 0 reviews in primary mode
- Re-crawl fresh businesses (<14 days since last crawl)

### Secondary Crawling
✅ **DO**:
- Check businesses monthly (30-day interval)
- Prioritize never-checked businesses first
- Focus on categories likely to gain reviews (healthcare, restaurants)

❌ **DON'T**:
- Check too frequently (<30 days) - waste of API calls
- Abandon businesses after 1-2 checks - be patient

---

## Advanced Features

### Custom Check Intervals by Category

Some categories gain reviews faster than others:

```sql
-- Restaurants/food: Check every 14 days
-- Healthcare: Check every 30 days
-- B2B services: Check every 60 days

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS review_check_interval_days INTEGER DEFAULT 30;

UPDATE businesses
SET review_check_interval_days = CASE
  WHEN category LIKE '%restaurant%' OR category LIKE '%café%' THEN 14
  WHEN category LIKE '%Tandarts%' OR category LIKE '%Fysiotherapeut%' THEN 30
  ELSE 60
END;
```

### Automatic Priority Recalculation

Create a database function to automatically update priorities when review counts change:

```sql
CREATE OR REPLACE FUNCTION update_crawl_priority()
RETURNS TRIGGER AS $$
BEGIN
  NEW.crawl_priority := CASE
    WHEN NEW.reviews_count >= 500 THEN 'high'
    WHEN NEW.reviews_count >= 100 THEN 'medium'
    WHEN NEW.reviews_count > 0 THEN 'standard'
    ELSE 'low'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_crawl_priority
BEFORE UPDATE OF reviews_count ON businesses
FOR EACH ROW
WHEN (OLD.reviews_count IS DISTINCT FROM NEW.reviews_count)
EXECUTE FUNCTION update_crawl_priority();
```

---

## Summary

This smart two-tier crawling strategy:

✅ **Eliminates waste** - No crawling of 0-review businesses in primary mode
✅ **Detects growth** - Periodic checks catch when businesses gain reviews
✅ **Optimizes costs** - 32% reduction in crawling expenses
✅ **Improves ROI** - 100% of primary crawls yield data
✅ **Scales intelligently** - Priority system focuses on high-value targets

**Your 853 zero-review businesses** are now monitored intelligently without wasting daily crawl budget!
