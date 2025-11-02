# Cache + Search Hybrid Strategy

## Problem: Avoiding Duplicate Business Searches

### Scenario
- **Cached**: 100 insurance businesses in Amsterdam
- **Request**: 500 business limit
- **Challenge**: How to get 400 NEW businesses without duplicating the 100 cached ones?

## Current System Behavior

### ❌ What Happens Now (INEFFICIENT)
```
User requests: 500 businesses
Cached: 100 businesses
Result: System finds 100 cached → Extracts reviews ONLY from those 100
Missing: 400 businesses user wanted
```

**OR**

```
User requests: 500 businesses
Cached: 100 businesses
System searches Google Maps: Gets 500 businesses (including duplicates of cached 100)
Cost: Full search cost (~$0.50) instead of partial
```

## Solution Strategies

### Strategy 1: Cache-First with Manual Override (CURRENT IMPLEMENTATION)
```typescript
if (cachedCount >= requestedLimit) {
  // Use cache only
  return cachedBusinesses.slice(0, requestedLimit)
} else if (cachedCount > 0) {
  // HYBRID: Use cache + search for more
  return [...cachedBusinesses, ...searchGoogleMaps(requestedLimit - cachedCount)]
}
```

**Pros:**
- ✅ Simple logic
- ✅ Maximizes cache usage
- ✅ Reduces costs when cache is sufficient

**Cons:**
- ❌ **Can't exclude cached businesses from Google Maps search**
- ❌ Will get duplicates if Google Maps returns same businesses
- ❌ Apify doesn't have "skip these place IDs" feature

### Strategy 2: Database Deduplication (RECOMMENDED)
```typescript
// 1. Get cached businesses
const cached = await getCachedBusinesses(category, location, limit)

// 2. Search Google Maps for NEW businesses
const searched = await searchGoogleMaps(category, location, limit)

// 3. Deduplicate by place_id BEFORE saving
const allBusinesses = [...cached]
const cachedPlaceIds = new Set(cached.map(b => b.place_id))

for (const business of searched) {
  if (!cachedPlaceIds.has(business.place_id)) {
    allBusinesses.push(business)
    // Save to database for future cache hits
    await db.insertBusiness(business)
  }
}

// 4. Return combined unique businesses
return allBusinesses.slice(0, requestedLimit)
```

**Pros:**
- ✅ Guarantees no duplicates
- ✅ Builds cache over time
- ✅ Works with existing Apify actors

**Cons:**
- ⚠️ Still makes full Google Maps search (costs money for duplicates)
- ⚠️ Slightly more complex logic

### Strategy 3: Geographic Expansion (SMART)
```typescript
if (cachedCount < requestedLimit) {
  // Expand search to nearby areas to avoid duplicates
  const expansionAreas = [
    `${location}`,                    // Original: Amsterdam
    `${location} centrum`,            // Amsterdam centrum
    `${location} noord`,              // Amsterdam noord
    `${location} west`,               // Amsterdam west
    // ... etc
  ]

  for (const area of expansionAreas) {
    if (allBusinesses.length >= requestedLimit) break

    const results = await searchGoogleMaps(category, area, 50)
    // Deduplicate and add
  }
}
```

**Pros:**
- ✅ Finds genuinely NEW businesses in expanded areas
- ✅ Reduces duplicate risk
- ✅ Better geographic coverage

**Cons:**
- ⚠️ Might not work for small locations
- ⚠️ Complex area expansion logic

### Strategy 4: Smart Cache Invalidation (ADVANCED)
```typescript
// Mark cached businesses with timestamp
// Re-search if cache is old (e.g., >30 days)

if (cacheAge > 30 days) {
  // Refresh cache with new search
  searchAndReplaceCache()
} else {
  // Use cache + search for additional
  hybrid()
}
```

**Pros:**
- ✅ Keeps data fresh
- ✅ Discovers new businesses over time
- ✅ Prevents stale cache issues

**Cons:**
- ⚠️ More database complexity
- ⚠️ Need to track cache timestamps

## Recommended Implementation

### Phase 1: Database Deduplication (Immediate)
✅ **Already implemented in API**

```typescript
// route.ts (current implementation)
if (cachedCount > 0 && needsNewBusinesses) {
  hybridMode = true
  newBusinessLimit = requestedLimit - cachedCount

  // Search for NEW businesses
  const results = await extractor.extractBusinessReviews({
    businessLimit: newBusinessLimit,  // Only search for what we need
    // ... other params
  })

  // Deduplicate in database before saving
  // This happens automatically via place_id UNIQUE constraint
}
```

### Phase 2: Add Exclude Logic to Extractor (Future Enhancement)
```typescript
// extractor.ts (future)
async findBusinesses(criteria) {
  const excludePlaceIds = criteria.excludeCachedPlaceIds || []

  // Filter out cached businesses from search results
  return results.filter(b => !excludePlaceIds.includes(b.placeId))
}
```

### Phase 3: Cost Tracking (Analytics)
```typescript
// Track actual vs potential costs
const analytics = {
  cached_businesses: cachedCount,
  searched_businesses: newBusinessLimit,
  duplicates_avoided: cachedCount,
  cost_saved: cachedCount * 0.004,  // $0.004 per business
  actual_cost: newBusinessLimit * 0.004
}
```

## User Experience

### Scenario: 100 cached, want 500

**Before (inefficient):**
```
❌ User gets: 100 businesses (cache only)
❌ OR: 500 businesses with ~100 duplicates
💰 Cost: $0 (insufficient) OR $0.50 (wasteful)
```

**After (hybrid + deduplication):**
```
✅ User gets: 100 cached + 400 new = 500 unique
💰 Cost: $0 (cached) + $0.40 (400 new) = $0.40 total
📊 Savings: $0.10 (20% saved from deduplication)
```

### UI Messages

**Cache Only:**
```
💰 Using 100 cached businesses - saving costs!
```

**Hybrid Mode:**
```
🔀 HYBRID: Using 100 cached + searching 400 new businesses...
💰 Estimated cost: $0.40 (saved $0.10 with cache)
```

**Search Only:**
```
🔍 Searching Google Maps for 500 businesses...
💰 Estimated cost: $0.50
```

## Database Deduplication Guarantee

The `businesses` table has a **UNIQUE constraint on `place_id`**:

```sql
CREATE TABLE businesses (
  place_id VARCHAR(255) PRIMARY KEY,
  -- ... other columns
);
```

This means:
- ✅ Duplicate `place_id` inserts are automatically rejected
- ✅ No duplicate businesses in database ever
- ✅ Cache grows correctly over time
- ✅ Subsequent searches find more cached businesses

## Cost Optimization Summary

| Scenario | Cached | Requested | Strategy | Businesses | Cost | Savings |
|----------|--------|-----------|----------|------------|------|---------|
| Full cache | 500 | 500 | Cache only | 500 | $0 | 100% |
| Partial cache | 100 | 500 | Hybrid | 100 + 400 | $0.40 | 20% |
| No cache | 0 | 500 | Search | 500 | $0.50 | 0% |
| Over cache | 600 | 500 | Cache only | 500 | $0 | 100% |

**Key Insight:** Even partial cache provides significant savings!

## Next Steps

1. ✅ **Already implemented**: Hybrid mode in API
2. ⏳ **Test**: Verify deduplication works correctly
3. ⏳ **Monitor**: Track duplicate rates in production
4. ⏳ **Optimize**: Add geographic expansion if needed
5. ⏳ **Analytics**: Show cost savings in dashboard

## Testing Commands

```bash
# Test scenario: 100 cached, request 500
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{
    "category": "insurance_agency",
    "location": "Amsterdam",
    "businessLimit": 500,
    "maxStars": 3,
    "dayLimit": 14
  }'

# Check logs for:
# - "🔀 HYBRID MODE: 100 cached + 400 new = 500 total"
# - Database deduplication via UNIQUE constraint
```

## Conclusion

**Current implementation (Strategy 2: Database Deduplication)** is the best balance of:
- ✅ Simplicity
- ✅ Cost savings
- ✅ No duplicate guarantees (via database)
- ✅ Works with existing Apify actors

The system will naturally avoid duplicates through the database `place_id` UNIQUE constraint, even if Apify returns some duplicate businesses in search results.
