# Universal Search System - Implementation Status

## ✅ COMPLETED (Ready to Use)

### 1. Type Definitions ✅
**File:** `src/lib/types/universal-search.ts`

- Complete `UniversalSearchCriteria` interface with all flexible parameters
- `BusinessWithMomentum` interface with enrichment fields
- `ReviewMomentumData` interface for momentum tracking
- `convertLegacyToUniversal()` helper for backward compatibility
- Ready to use in your code!

### 2. Database Migration ✅
**File:** `database/migrations/005_add_enrichment_to_businesses.sql`
**Status:** ✅ **APPLIED TO DATABASE**

**Added to `businesses` table:**
- `email_enriched`, `email_confidence`, `email_source`
- `owner_first_name`, `owner_last_name`, `owner_email`, `owner_title`, `owner_linkedin`
- `facebook_url`, `linkedin_url`, `instagram_url`, `twitter_url`, `youtube_url`
- `last_enriched_at`, `enrichment_provider`, `enrichment_cost_usd`
- Indexes for fast enrichment lookups

**New table:** `business_review_momentum`
- Caches momentum calculations for performance
- Tracks review velocity, trends, rating changes

**Helper functions:**
- `needs_enrichment(business_id, max_age_days)` - check if business needs re-enrichment
- `get_enrichment_coverage()` - get enrichment statistics

### 3. Review Momentum Analyzer ✅
**File:** `src/lib/services/review-momentum-analyzer.ts`

**Features:**
- `analyzeMomentum(businessId, periodDays)` - calculate momentum for a business
- `filterByMomentum(businesses, criteria)` - filter businesses by momentum
- `getCachedMomentum(businessId)` - get cached momentum (faster)
- `getMomentumStats(businessIds)` - aggregate momentum statistics

**Metrics calculated:**
- Review velocity (reviews/day)
- Trend type: increasing, decreasing, stable, spike
- Percent change vs previous period
- Rating trends: improving, declining, stable
- Automatically caches results in database

### 4. Business Cache with Enrichment ✅
**File:** `src/lib/services/business-cache.ts`
**Status:** ✅ **UPDATED**

- `upsert()` method now accepts all enrichment fields
- Stores enrichment data alongside business data
- Updates `last_enriched_at` timestamp when enrichment is added
- Prevents re-enriching the same businesses

---

## 🔧 REMAINING WORK (Quick Implementation Guide)

### 5. Update Extractor with Apify Enrichment (30 min)

**File to modify:** `src/lib/extractor.ts`

**Step 1:** Update `searchGoogleMaps()` method around line 750:

```typescript
private async searchGoogleMaps(query: string, maxItems = 10, countryCode = 'nl', language = 'nl', enrichment = false): Promise<Business[]> {
  const input = {
    searchStringsArray: [query],
    maxCrawledPlacesPerSearch: maxItems,
    language: language,
    countryCode: countryCode,
    includeImages: false,
    includeReviews: false,

    // 🆕 ADD ENRICHMENT (happens in Stage 1 - same API call!)
    includeWebsiteData: enrichment,      // Scrape business websites
    scrapeContactInfo: enrichment,        // Extract emails/phones
    scrapeSocialMedia: enrichment,        // Get social media links
    maxPagesPerQuery: enrichment ? 1 : 0, // Limit website crawl depth
  }

  const runId = await this.runApifyActor(this.actorMapsId, input)
  this.actorRunIds.push(runId)

  if (this.extractionId && runningExtractions.has(this.extractionId)) {
    runningExtractions.get(this.extractionId)!.actorRunIds.push(runId)
  }

  const results = await this.getApifyResults(runId, this.actorMapsId)

  // 🆕 Map enrichment data from Apify response
  if (enrichment && results) {
    return results.map((business: any) => ({
      ...business,
      email_enriched: business.emails?.[0] || null,
      email_source: business.emails?.[0] ? 'apify' : null,
      email_confidence: business.emails?.[0] ? 'medium' : null,
      facebook_url: business.socialMedia?.facebook || null,
      linkedin_url: business.socialMedia?.linkedin || null,
      instagram_url: business.socialMedia?.instagram || null,
      twitter_url: business.socialMedia?.twitter || null,
      enrichment_provider: 'apify',
      enrichment_cost_usd: 0.005, // Apify enrichment cost
    }))
  }

  return results || []
}
```

**Step 2:** Update `findBusinesses()` call around line 276:

```typescript
const businesses = await this.searchGoogleMaps(
  query,
  targetLimit,
  searchCriteria.countryCode || 'nl',
  searchCriteria.language || 'nl',
  searchCriteria.enrichment?.apifyEnrichment?.enabled || false // 🆕 Pass enrichment flag
)
```

**Step 3:** Store enrichment when caching businesses:

```typescript
// After getting businesses from Apify, save with enrichment
import { businessCache } from './services/business-cache'

for (const business of businesses) {
  await businessCache.upsert({
    place_id: business.placeId,
    name: business.title,
    address: business.address,
    // ... other fields ...

    // 🆕 Enrichment fields from Apify
    email_enriched: business.email_enriched,
    email_source: business.email_source,
    email_confidence: business.email_confidence,
    facebook_url: business.facebook_url,
    linkedin_url: business.linkedin_url,
    instagram_url: business.instagram_url,
    twitter_url: business.twitter_url,
    enrichment_provider: business.enrichment_provider,
    enrichment_cost_usd: business.enrichment_cost_usd,
  })
}
```

---

### 6. Create Universal Search Extractor (1 hour)

**File to create:** `src/lib/services/universal-extractor.ts`

```typescript
import { UniversalSearchCriteria, UniversalSearchResponse, BusinessWithMomentum } from '../types/universal-search'
import { UniversalBusinessReviewExtractor } from '../extractor'
import { businessCache } from './business-cache'
import { reviewMomentumAnalyzer } from './review-momentum-analyzer'
import { logger } from '../logger'

const universalLogger = logger.child({ module: 'universal-search' })

export class UniversalSearchExtractor {
  async search(criteria: UniversalSearchCriteria): Promise<UniversalSearchResponse> {
    const startTime = Date.now()

    universalLogger.info('Starting universal search', {
      category: criteria.category,
      location: criteria.location,
      enrichmentEnabled: criteria.enrichment?.enabled,
      reviewsEnabled: criteria.reviewFilters?.enabled,
      momentumEnabled: criteria.businessFilters?.reviewMomentum?.enabled,
    })

    try {
      // Step 1: Find businesses (with optional Apify enrichment)
      const businesses = await this.findBusinesses(criteria)

      // Step 2: Apply business filters
      let filteredBusinesses = await this.applyBusinessFilters(businesses, criteria)

      // Step 3: Filter by review momentum if requested
      if (criteria.businessFilters?.reviewMomentum?.enabled) {
        filteredBusinesses = await reviewMomentumAnalyzer.filterByMomentum(
          filteredBusinesses,
          criteria.businessFilters.reviewMomentum
        )
      }

      // Step 4: Extract reviews (ONLY if enabled)
      let reviews = []
      if (criteria.reviewFilters?.enabled) {
        reviews = await this.extractReviews(filteredBusinesses, criteria)
      }

      // Step 5: Calculate stats
      const stats = this.calculateStats(filteredBusinesses, reviews, criteria)

      // Step 6: Format response
      return {
        success: true,
        businesses: filteredBusinesses,
        reviews: criteria.output?.includeReviews ? reviews : undefined,
        searchCriteria: criteria,
        extractionDate: new Date(),
        stats,
      }

    } catch (error) {
      universalLogger.error('Universal search failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  private async findBusinesses(criteria: UniversalSearchCriteria): Promise<BusinessWithMomentum[]> {
    // Use existing extractor with enrichment flag
    const extractor = new UniversalBusinessReviewExtractor()

    const legacyCriteria = {
      category: criteria.category,
      location: criteria.location,
      businessLimit: criteria.limits?.maxBusinesses || 50,
      language: criteria.language,
      countryCode: criteria.countryCode,
      // Pass enrichment flag to extractor
      enrichment: criteria.enrichment,
    }

    // This will call searchGoogleMaps with enrichment enabled
    const businesses = await extractor.findBusinesses(legacyCriteria)

    return businesses
  }

  private async applyBusinessFilters(
    businesses: BusinessWithMomentum[],
    criteria: UniversalSearchCriteria
  ): Promise<BusinessWithMomentum[]> {
    let filtered = businesses

    const filters = criteria.businessFilters
    if (!filters) return filtered

    // Rating filters
    if (filters.minRating !== undefined) {
      filtered = filtered.filter(b => b.totalScore >= filters.minRating!)
    }
    if (filters.maxRating !== undefined) {
      filtered = filtered.filter(b => b.totalScore <= filters.maxRating!)
    }

    // Review count filters
    if (filters.minReviewCount !== undefined) {
      filtered = filtered.filter(b => b.reviewsCount >= filters.minReviewCount!)
    }
    if (filters.maxReviewCount !== undefined) {
      filtered = filtered.filter(b => b.reviewsCount <= filters.maxReviewCount!)
    }

    // Website/phone filters
    if (filters.mustHaveWebsite) {
      filtered = filtered.filter(b => b.website)
    }
    if (filters.mustHavePhone) {
      filtered = filtered.filter(b => b.phone)
    }

    return filtered
  }

  private async extractReviews(businesses: BusinessWithMomentum[], criteria: UniversalSearchCriteria): Promise<any[]> {
    // Use existing review extraction logic
    // ... (reuse existing code)
    return []
  }

  private calculateStats(businesses: BusinessWithMomentum[], reviews: any[], criteria: UniversalSearchCriteria) {
    const cachedBusinesses = businesses.filter(b => b.lastEnrichedAt !== undefined).length
    const enrichedBusinesses = businesses.filter(b => b.email_enriched || b.owner_email).length

    const apifyCost = businesses.length * (criteria.enrichment?.apifyEnrichment?.enabled ? 0.009 : 0.004)
    const reviewsCost = reviews.length * 0.02

    return {
      totalBusinesses: businesses.length,
      totalReviews: reviews.length,
      cachedBusinesses,
      newBusinesses: businesses.length - cachedBusinesses,
      enrichedBusinesses,
      apifyCostUsd: Number(apifyCost.toFixed(2)),
      apolloCostUsd: 0, // TODO: Calculate if Apollo was used
      totalCostUsd: Number((apifyCost + reviewsCost).toFixed(2)),
      cacheHitRate: Number((cachedBusinesses / businesses.length * 100).toFixed(1)),
      savingsUsd: Number((cachedBusinesses * 0.009).toFixed(2)),
    }
  }
}

export const universalSearchExtractor = new UniversalSearchExtractor()
```

---

### 7. Update API Route (15 min)

**File to modify:** `src/app/api/extract/route.ts`

Add support for universal search criteria:

```typescript
import { convertLegacyToUniversal } from '@/lib/types/universal-search'
import { universalSearchExtractor } from '@/lib/services/universal-extractor'

export async function POST(request: NextRequest) {
  const searchCriteria = await request.json()

  // Check if it's universal or legacy format
  const isUniversal = searchCriteria.businessFilters !== undefined ||
                      searchCriteria.enrichment !== undefined ||
                      searchCriteria.reviewFilters !== undefined

  let criteria
  if (isUniversal) {
    criteria = searchCriteria
  } else {
    // Convert legacy to universal
    criteria = convertLegacyToUniversal(searchCriteria)
  }

  // Use universal extractor
  const results = await universalSearchExtractor.search(criteria)

  // ... rest of streaming response logic
}
```

---

## 🎯 QUICK START GUIDE

### Example 1: Lead Generation (No Reviews)

```typescript
const leadGenSearch = {
  category: 'dentist',
  location: 'Spain',

  businessFilters: {
    minRating: 4.0,
    minReviewCount: 50,
    mustHaveWebsite: true,
  },

  reviewFilters: {
    enabled: false,  // ❌ Don't extract reviews
  },

  limits: {
    maxBusinesses: 100,
  },

  enrichment: {
    enabled: true,
    apifyEnrichment: {
      enabled: true,
      scrapeWebsite: true,
      scrapeSocialMedia: true,
      maxPagesPerSite: 1,
    },
  },

  output: {
    includeReviews: false,
    format: 'contacts-only',
  },
}

// Cost: ~$0.90 for 100 dentists with contact data
```

### Example 2: Review Analysis with Momentum

```typescript
const momentumSearch = {
  category: 'hotel',
  location: 'Amsterdam',

  businessFilters: {
    reviewMomentum: {
      enabled: true,
      period: 30,
      minReviewsInPeriod: 5,
      type: 'declining', // Find hotels with declining reviews
    },
  },

  reviewFilters: {
    enabled: true,
    maxStars: 3,
    dayLimit: 14,
  },

  limits: {
    maxBusinesses: 50,
  },

  enrichment: {
    enabled: true,
    apifyEnrichment: {
      enabled: true,
      scrapeWebsite: true,
    },
  },
}

// Cost: ~$1.45 (enrichment + reviews)
```

---

## 📊 TESTING

Run these commands to test:

```bash
# 1. Check database migration worked
node -e "
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});
(async () => {
  const result = await pool.query('SELECT * FROM get_enrichment_coverage()');
  console.log('Enrichment Coverage:', result.rows[0]);
  await pool.end();
})();
"

# 2. Test momentum analyzer
# (Create test file and run)

# 3. Test API with universal search
curl -X POST http://localhost:3069/api/extract \
  -H "Content-Type: application/json" \
  -d '{
    "category": "dentist",
    "location": "Amsterdam",
    "businessFilters": { "minRating": 4.0 },
    "reviewFilters": { "enabled": false },
    "limits": { "maxBusinesses": 10 },
    "enrichment": {
      "enabled": true,
      "apifyEnrichment": { "enabled": true, "scrapeWebsite": true }
    }
  }'
```

---

## 🎉 BENEFITS

### Cost Savings
- ✅ Enrichment cached - never pay twice for same business
- ✅ Skip reviews when not needed - save $0.02/business
- ✅ Apify enrichment - $0.005 vs Apollo $0.40-1.80

### Flexibility
- ✅ Lead generation without reviews
- ✅ Market research with minimal data
- ✅ Review momentum tracking
- ✅ Backward compatible with existing code

### Performance
- ✅ Cached momentum calculations
- ✅ Enrichment stored in database
- ✅ Smart filtering before expensive operations

---

## 📞 SUPPORT

If you need help completing the implementation:
1. Review the "REMAINING WORK" section above
2. Each section has clear code examples
3. Estimated time: 1.5-2 hours total

The hard work is done - just need to wire it all together!
