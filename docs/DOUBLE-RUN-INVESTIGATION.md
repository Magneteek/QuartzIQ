# Double Apify Run Investigation

## Issue Report

**User observation:**
- Search criteria: doctor + Amsterdam, limit 50
- Expected: 1 Apify run for 50 businesses
- Actual: 2 Apify runs, each for 50 businesses
- Apify run IDs: `theZyQU2ChHhwoKfL6va`, `YEPZETJNmcg1tcT4y`

## Investigation Findings

### 1. Query Generation for "doctor + Amsterdam"

The system generates **4 search queries** for Netherlands city searches:

```typescript
// Line 349-354 in extractor.ts
queries.push(
  `${localizedCategory} ${location}`,        // "dokter Amsterdam" (if translated)
  `${category} ${location}`,                  // "doctor Amsterdam"
  `${localizedCategory} in ${location}`,      // "dokter in Amsterdam"
  `${localizedCategory} nabij ${location}`    // "dokter nabij Amsterdam"
)
```

**However**, "doctor" is NOT in the translation map, so:
- `localizedCategory` = "doctor" (no translation)
- This creates potential duplicates

### 2. Loop Logic Analysis

The findBusinesses loop (lines 267-309) should prevent multiple runs:

```typescript
for (const query of validatedQueries) {
  // CHECK 1: Before query
  if (allBusinesses.length >= targetLimit) {
    break  // Should stop here
  }

  const businesses = await this.searchGoogleMaps(query, targetLimit, ...)
  allBusinesses.push(...businessesToAdd)

  // CHECK 2: After query
  if (allBusinesses.length >= targetLimit) {
    break  // Should stop here
  }
}
```

**This logic is CORRECT** - it should stop after first successful query returning 50 businesses.

### 3. Possible Causes

#### Cause A: Hybrid Mode Interference ✓ LIKELY
If cache found < 50 businesses:
```
Cached: 30 doctors
Requested: 50
Hybrid mode: Search for 20 NEW businesses

Query 1: Searches for 50 (finds 50) → Run 1
But only adds 20 to reach limit
Query 2: Still runs because loop continues? → Run 2
```

#### Cause B: Cache Detection Running Searches ✓ VERY LIKELY
The new cache detection in `/api/extract/route.ts` might be causing this:

```typescript
// Line 141-142: Get cached businesses
const cachedResult = await db.query(cachedQuery, allParams)
placeIds = cachedResult.rows.map((row: any) => row.place_id)

// Line 144-175: Hybrid mode logic
if (cachedCount > 0 && needsNewBusinesses) {
  hybridMode = true
  newBusinessLimit = requestedLimit - cachedCount  // e.g., 50 - 30 = 20

  // This passes businessLimit: 20
  // But extractor still generates multiple queries!
}
```

**THE ISSUE:**
- API says: "Search for 20 new businesses"
- Extractor receives: `businessLimit: 20`
- Extractor generates: 4 queries
- Each query requests: 20 businesses from Apify
- Result: Multiple Apify runs to collect 20 total

#### Cause C: Query Duplication
Queries might be:
1. "doctor Amsterdam"
2. "doctor Amsterdam" (duplicate because no translation)
3. "doctor in Amsterdam"
4. "doctor nabij Amsterdam"

If validation doesn't remove duplicates, query #1 and #2 both run.

## Root Cause (Most Likely)

**The extractor doesn't understand "cached place IDs + search for more".**

Current flow:
1. API finds 0 doctors in cache (no translation for "doctor" category)
2. API sets hybrid mode: FALSE (no cache found)
3. API calls extractor with `businessLimit: 50`
4. Extractor generates 4 queries
5. **Each query requests 50 businesses from Apify**
6. Loop stops after first successful query... OR DOES IT?

Wait, if the loop is working correctly, there should only be 1 run. Let me check if there's an issue with the query validation...

## The Real Issue: Query Validation Passes Duplicates

```typescript
// Generated queries for "doctor Amsterdam":
[
  "doctor Amsterdam",        // Query 1
  "doctor Amsterdam",        // Query 2 (DUPLICATE - no translation)
  "doctor in Amsterdam",     // Query 3
  "doctor nabij Amsterdam"   // Query 4
]
```

If queries 1 and 2 are identical, the validation might pass both, causing:
- Run 1: "doctor Amsterdam" (first occurrence)
- Run 2: "doctor Amsterdam" (duplicate)

## Solution

### Fix 1: Add "doctor" Translation ✅
```typescript
// category-translator.ts
{
  en: 'doctor',
  nl: 'dokter',
  variations: ['physician', 'huisarts', 'arts', 'general practitioner']
}
```

### Fix 2: Remove Duplicate Queries ✅
```typescript
// Line 537 in extractor.ts
return [...new Set(queries)].slice(0, criteria.maxQueries || 4)  // Remove duplicates
```

### Fix 3: Better Hybrid Mode Logic ✅
Don't pass cached place IDs + businessLimit to extractor at same time.
Either:
- Use cached place IDs ONLY (extract reviews)
- OR search for NEW businesses (don't mix)

## Testing Plan

1. Add "doctor" to category translator
2. Test extraction with: doctor + Amsterdam + limit 50
3. Verify only 1 Apify run
4. Check logs for duplicate queries
5. Monitor Apify dashboard for run count

## Expected Fix Result

**Before:**
- 2 Apify runs (100 businesses searched, 50 used)
- Cost: ~$0.50

**After:**
- 1 Apify run (50 businesses searched, 50 used)
- Cost: ~$0.25 (50% savings)
