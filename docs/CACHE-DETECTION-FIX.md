# Cache Detection Fix - Category Mapping Solution

## Problem Identified

The cache detection was showing "No cached businesses found" for "Insurance Agency" + "Amsterdam" even though **108 insurance businesses** were cached in the database.

### Root Cause

**Language Mismatch:**
- UI sends: `insurance_agency` (English category ID)
- Database has: Dutch category names from Apify import
  - "Verzekeringsagentschap" (Insurance agency) - 56 businesses
  - "Verzekeringsmakelaar" (Insurance broker) - 25 businesses
  - "Verzekeringsmaatschappij" (Insurance company) - 13 businesses
  - Plus others

The SQL query was searching for `LIKE '%insurance_agency%'` which doesn't match any Dutch categories.

## Solution Implemented

### 1. Category Mapping System

Created [/src/lib/utils/category-mapping.ts](cci:7://file:///Users/kris/CLAUDEtools/QuartzIQ/src/lib/utils/category-mapping.ts:0:0-0:0) with:

```typescript
export const CATEGORY_MAPPINGS: CategoryMapping[] = [
  {
    englishId: 'insurance_agency',
    dutchCategories: [
      'Verzekeringsagentschap',
      'Verzekeringsmakelaar',
      'Verzekeringsmaatschappij',
      'Autoverzekering',
      'Ziektekostenverzekeraar',
      'Tussenpersoon voor levensverzekeringen',
      'Tussenpersoon voor woningverzekering'
    ],
    searchTerms: ['verzekering', 'insurance', 'assur']
  },
  // ... other categories (dentist, physical_therapist, etc.)
]
```

### 2. SQL Query Builder

Created `generateCategoryWhereClause()` function that:
- Maps English category IDs to Dutch database categories
- Builds SQL with exact matches for Dutch categories
- Adds LIKE queries for search terms
- Returns parameterized query to prevent SQL injection

**Generated SQL Example:**
```sql
WHERE (
  LOWER(category) = LOWER($1)  -- 'Verzekeringsagentschap'
  OR LOWER(category) = LOWER($2)  -- 'Verzekeringsmakelaar'
  OR LOWER(category) = LOWER($3)  -- 'Verzekeringsmaatschappij'
  ... (7 exact matches)
  OR LOWER(category) LIKE LOWER($8)  -- '%verzekering%'
  OR LOWER(category) LIKE LOWER($9)  -- '%insurance%'
  OR LOWER(category) LIKE LOWER($10)  -- '%assur%'
)
AND (LOWER(city) LIKE LOWER($11) OR LOWER(address) LIKE LOWER($11))  -- '%Amsterdam%'
```

### 3. Updated Cache Detection API

Modified [/src/app/api/check-cache/route.ts](cci:7://file:///Users/kris/CLAUDEtools/QuartzIQ/src/app/api/check-cache/route.ts:0:0-0:0):

**Before:**
```typescript
const result = await db.query(`
  SELECT COUNT(*) as cached_count
  FROM businesses
  WHERE
    (LOWER(category) LIKE LOWER($1) OR LOWER(category) LIKE LOWER($2))
    AND (LOWER(city) LIKE LOWER($3) OR LOWER(address) LIKE LOWER($3))
`, [`%${category}%`, category, `%${location}%`]);
```

**After:**
```typescript
import { generateCategoryWhereClause } from '@/lib/utils/category-mapping';

const { clause: categoryClause, params: categoryParams } = generateCategoryWhereClause(category, 1);
const locationParam = categoryParams.length + 1;
const allParams = [...categoryParams, `%${location}%`];

const countQuery = `
  SELECT COUNT(*) as cached_count
  FROM businesses
  WHERE
    ${categoryClause}
    AND (LOWER(city) LIKE LOWER($${locationParam}) OR LOWER(address) LIKE LOWER($${locationParam}))
`;

const result = await db.query(countQuery, allParams);
```

## Test Results

### Before Fix:
```bash
$ node scripts/debug-cache-categories.js
API Query Result: 0 businesses found
```

### After Fix:
```bash
$ node scripts/test-category-mapping.js
✅ SUCCESS! Found 108 businesses

Sample businesses:
- BouwPolis | Verzekeringsagentschap | Amsterdam
- AIOI Motor and General Insurance Company of Europe Limited | Verzekeringsagentschap | Amsterdam
- London General Insurance Company Limited | Verzekeringsagentschap | Amsterdam
- Atradius Insurance Holding N.v. | Verzekeringsagentschap | Amsterdam
- DDW Group | Verzekeringsmakelaar | Amsterdam
```

## Category Mappings Added

1. **insurance_agency** → 7 Dutch categories + 3 search terms
2. **dentist** → 15 Dutch categories + 4 search terms
3. **physical_therapist** → 2 Dutch categories + 3 search terms
4. **real_estate_agency** → 5 Dutch categories + 4 search terms
5. **financial_advisor** → 3 Dutch categories + 3 search terms

## Benefits

1. **Accurate Detection**: Finds all relevant businesses regardless of language
2. **Comprehensive Coverage**: Includes related categories (e.g., "Verzekeringsmakelaar" = Insurance broker)
3. **Flexible Search**: Both exact matches and LIKE queries for variations
4. **Easy Extension**: Simple to add new category mappings as needed
5. **SQL Injection Safe**: Uses parameterized queries

## Files Changed

1. **Created** `/src/lib/utils/category-mapping.ts` - Category mapping utility
2. **Modified** `/src/app/api/check-cache/route.ts` - Updated to use mapping
3. **Created** `/scripts/debug-cache-categories.js` - Debugging script
4. **Created** `/scripts/test-category-mapping.js` - Test script
5. **Modified** `/database/db.ts` - Fixed TypeScript types
6. **Modified** `/tsconfig.json` - Excluded scripts from build
7. **Modified** `/src/app/api/airtable/send-contacts/route.ts` - Fixed TS error
8. **Installed** `@types/pg` - PostgreSQL type definitions

## Next Steps

1. ✅ Test in UI - User should now see "108 Businesses Already Cached!"
2. ⏳ Add more category mappings as needed
3. ⏳ Consider adding language detection for automatic mapping
4. ⏳ Monitor for edge cases and add fallback logic if needed

## Expected User Experience

**User selects**: Insurance Agency + Amsterdam

**Before**:
```
❌ No cached businesses found.
We'll search Google Maps for Insurance Agency in Amsterdam.
Cost: ~$0.50
```

**After**:
```
✅ 108 Businesses Already Cached!
Found 108 insurance businesses in Amsterdam

[Use Cached (Instant, $0)]  [Search New (~$0.50)]

Cost breakdown:
Cached: $0.00 | Search New: $0.50 | You Save: $0.50 (100%)
```

## Technical Notes

- All queries are parameterized for security
- Supports both exact matches and fuzzy search
- Maintains backward compatibility with unknown categories
- Logging added for debugging: `[Cache Detection] Query:` and `[Cache Detection] Found:`
- Works with existing hook and banner components
