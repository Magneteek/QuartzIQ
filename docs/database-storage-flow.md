# Automatic Database Storage Flow

## Quick Answer: YES, Data is Stored Automatically! ✅

When you run a new crawl through `/api/extract-optimized`, **all data is automatically stored in PostgreSQL** with no manual intervention required.

---

## Complete Storage Flow

### Step 1: Extraction Request
```
User → Dashboard → POST /api/extract-optimized → optimized-extractor.ts
```

### Step 2: Database Storage (Automatic)

#### 📊 **Extraction Metadata** (Always Stored)
**Table**: `extractions`
**When**: Immediately when extraction starts
**Data Stored**:
```sql
INSERT INTO extractions (
  id,                    -- UUID
  organization_id,       -- Your organization UUID
  search_criteria,       -- JSON: category, location, filters
  extraction_type,       -- 'manual' or 'scheduled'
  status,                -- 'in_progress' → 'completed'
  started_at,            -- Timestamp
  completed_at,          -- Timestamp (when done)
  businesses_found,      -- Count
  reviews_extracted,     -- Count
  apify_credits_used,    -- Cost tracking
  apify_cost_usd         -- Dollar amount
)
```

**Code Location**: [optimized-extractor.ts:333-348](src/lib/services/optimized-extractor.ts#L333-L348)

---

#### 🏢 **Business Data** (Cached Automatically)
**Table**: `businesses`
**When**: As soon as Apify returns businesses
**Data Stored**:
```sql
INSERT INTO businesses (
  id,                    -- UUID (auto-generated)
  place_id,              -- Google Maps Place ID (unique)
  name,                  -- Business name
  category,              -- e.g., "tandarts"
  address,               -- Full address
  city,                  -- City name
  postal_code,           -- Postal code
  country_code,          -- e.g., "nl"
  phone,                 -- Phone number
  website,               -- Website URL
  email,                 -- Email (if available)
  rating,                -- Google rating (e.g., 4.5)
  reviews_count,         -- Number of reviews
  google_maps_url,       -- Maps link
  status,                -- 'active', 'closed', etc.
  last_scraped_at,       -- Timestamp
  scrape_count,          -- How many times scraped
  raw_data               -- Full JSON from Apify
)
ON CONFLICT (place_id) DO UPDATE ...  -- Upserts existing businesses
```

**Deduplication**: If a business with the same `place_id` exists, it **updates** the existing record instead of creating a duplicate.

**Code Location**: [optimized-extractor.ts:183-199](src/lib/services/optimized-extractor.ts#L183-L199)

**Storage Service**: [business-cache.ts](src/lib/services/business-cache.ts)

---

#### ⭐ **Review Data** (Cached Automatically)
**Table**: `reviews`
**When**: As reviews are extracted from Apify
**Data Stored**:
```sql
INSERT INTO reviews (
  id,                    -- UUID (auto-generated)
  business_id,           -- Foreign key to businesses table
  review_id,             -- Google review ID (unique)
  reviewer_name,         -- Reviewer's name
  rating,                -- Star rating (1-5)
  text,                  -- Review text content
  published_date,        -- Date review was published
  extracted_at,          -- Timestamp we extracted it
  sentiment_score,       -- AI sentiment analysis
  sentiment_label,       -- 'positive', 'negative', 'neutral'
  source,                -- 'apify', 'manual', etc.
  language,              -- 'nl', 'en', etc.
  review_hash,           -- Hash for deduplication
  owner_response,        -- Business owner's response
  owner_response_date,   -- Response date
  raw_data               -- Full JSON from Apify
)
ON CONFLICT (review_hash) DO NOTHING  -- Prevents duplicates
```

**Deduplication**: Reviews are hashed, so the same review won't be stored twice even if you crawl the same business multiple times.

**Code Location**: [review-cache.ts:insertBatch()](src/lib/services/review-cache.ts)

---

### Step 3: File System Storage (Contact Vault)

#### 📁 **Extraction History Files**
**Location**: `/data/extraction-history/`
**When**: After extraction completes
**Files Created**:
1. `extraction_[timestamp]_[id].json` - Full extraction data with businesses and reviews
2. `index.json` - Updated with extraction summary

**Data Stored**:
```json
{
  "id": "extraction_1760262423403_w3ouqhurj",
  "timestamp": "2025-10-12T09:47:03.403Z",
  "searchCriteria": {
    "category": "dentist",
    "location": "Amsterdam",
    "maxStars": 3,
    "dayLimit": 14
  },
  "results": {
    "businesses": [...],  // Full business objects
    "reviews": [...]      // Full review objects with business_name
  },
  "statistics": {
    "businessesFound": 10,
    "reviewsFound": 5,
    "avgRating": 2.4,
    "extractionTime": 125000
  }
}
```

**Code Location**: [history-manager.ts:saveExtraction()](src/lib/history-manager.ts#L76-L147)

**Purpose**: Powers the "Contact Vault" feature in the UI for quick review of past extractions.

---

## Data Flow Diagram

```
User Triggers Extraction
         ↓
   [API Authentication]
         ↓
   [Extraction Record Created] → PostgreSQL: extractions table
         ↓
   [Fetch from Apify or Cache]
         ↓
   [Smart Crawl Optimizer] → Filters businesses without reviews
         ↓
   [Cache Businesses] → PostgreSQL: businesses table (UPSERT)
         ↓
   [Extract Reviews]
         ↓
   [Cache Reviews] → PostgreSQL: reviews table (INSERT IGNORE duplicates)
         ↓
   [Update Extraction Record] → PostgreSQL: Update status, costs, counts
         ↓
   [Save to Contact Vault] → File System: extraction-history/
         ↓
   [Return Response to UI]
```

---

## What's Stored vs What's Not

### ✅ **Stored Automatically**
1. All businesses found (with deduplication)
2. All qualifying reviews (with deduplication)
3. Extraction metadata (costs, timing, criteria)
4. Contact vault history files

### ❌ **NOT Stored Automatically**
1. Enrichment data (phone, email) - requires separate enrichment step
2. Apollo.io contact data - requires enrichment action
3. LinkedIn executive data - requires enrichment action
4. Exports (CSV, JSON) - generated on-demand

---

## Database Tables Overview

| Table | Purpose | Auto-Populated | Deduplication |
|-------|---------|---------------|---------------|
| **organizations** | Your account data | Manual setup | N/A |
| **extractions** | Extraction jobs | ✅ Every crawl | New record each time |
| **businesses** | Business profiles | ✅ Every crawl | By `place_id` |
| **reviews** | Customer reviews | ✅ Every crawl | By `review_hash` |
| **contact_enrichments** | Apollo/LinkedIn data | ❌ Manual action | By business + type |
| **api_usage_logs** | API cost tracking | ✅ Every API call | N/A |

---

## Storage Costs & Limits

### Current Database: Supabase PostgreSQL
- **Free Tier**: 500MB database
- **Average Storage**:
  - Business: ~2KB per record
  - Review: ~1KB per record
  - 1000 businesses + 3000 reviews = ~5MB

**Capacity Estimate**: Can store ~200,000 businesses + 600,000 reviews before hitting 500MB limit

### Contact Vault Files
- **Location**: `/data/extraction-history/`
- **Retention**: Last 50 extractions kept
- **Auto-Cleanup**: Older extractions deleted automatically

---

## Verifying Auto-Storage

### Check if Data is Being Stored:

```bash
# Connect to database
psql $DATABASE_URL

# Check recent businesses
SELECT COUNT(*), MAX(last_scraped_at) FROM businesses;

# Check recent reviews
SELECT COUNT(*), MAX(extracted_at) FROM reviews;

# Check recent extractions
SELECT id, search_criteria->>'category', businesses_found, reviews_extracted
FROM extractions
ORDER BY started_at DESC
LIMIT 5;
```

### Or use the UI:
1. Go to Dashboard → Database Status Indicator (top right)
2. Shows live connection status and record counts
3. Green = Connected, Red = Issue

---

## Summary

**YES - Everything is stored automatically** when you run a crawl:

✅ Businesses → PostgreSQL `businesses` table (upserted by `place_id`)
✅ Reviews → PostgreSQL `reviews` table (deduplicated by hash)
✅ Extraction metadata → PostgreSQL `extractions` table
✅ Contact Vault → File system `/data/extraction-history/`

**The only manual step is enrichment** - adding phone numbers, emails, LinkedIn contacts through the enrichment actions in the UI.

No configuration needed - it all happens automatically! 🎯
