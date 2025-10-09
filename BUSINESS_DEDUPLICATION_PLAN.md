# Business Deduplication System - Implementation Plan

## Overview
Implement a master "already scraped businesses" tracking system to prevent re-scraping the same businesses and clearly identify new vs. previously scraped businesses in extraction results.

## Problem Statement
- Need to track all businesses ever scraped to avoid duplicate outreach
- When re-scraping same category, must identify which businesses are NEW
- Businesses that become customers will likely reach out themselves
- No need to track "contacted" status - just track "already scraped"

## Technical Implementation

### 1. Create Scraped Business Storage (30 min)

**File:** `/data/scraped-businesses.json`
```json
{
  "ChIJ4U-2c4Vrx0cRNNvmVHNu4bw": {
    "businessName": "Dental Clinics Nieuw Bergen",
    "address": "Jeroen Boschstraat 10, Bergen",
    "firstScraped": "2025-10-07T15:30:00.000Z",
    "category": "tandarts",
    "location": "Netherlands"
  },
  "ChIJuS2cYKbot0cRX4VHpAFsFLI": {
    "businessName": "Dealerauto's Emmen",
    "firstScraped": "2025-10-07T15:30:00.000Z",
    "category": "car_dealer",
    "location": "Netherlands"
  }
}
```

**New API Endpoint:** `/api/scraped-businesses/route.ts`
- GET: Load scraped businesses list
- POST: Add businesses to scraped list
- DELETE: Remove business from list (optional)

### 2. Auto-Track After Extraction (30 min)

**Update:** `/src/components/dashboard/enhanced-review-extraction-dashboard.tsx`

**After extraction completes:**
- Automatically add all scraped businesses to master list
- Call API to save placeIds with metadata
- Show toast notification: "X new businesses added to tracking"

**Implementation location:** In `handleSearchSubmit` after extraction succeeds

```typescript
// After extraction completes
const response = await fetch('/api/scraped-businesses', {
  method: 'POST',
  body: JSON.stringify({
    businesses: extraction.results.businesses.map(b => ({
      placeId: b.placeId,
      businessName: b.title,
      address: b.address,
      firstScraped: new Date().toISOString(),
      category: searchCriteria.category,
      location: searchCriteria.location
    }))
  })
})
```

### 3. Mark Businesses in Results Display (30 min)

**Update Business Interface:**
```typescript
interface Business {
  // ... existing fields
  isNew?: boolean
  alreadyScraped?: boolean
  previouslyScrapeDate?: string
}
```

**Update:** `/src/components/cards/enhanced-business-card.tsx`
- Add visual indicators:
  - 🆕 NEW badge (green) - Never scraped before
  - 🔄 SEEN badge (gray) - Previously scraped with date tooltip

**When displaying results:**
- Fetch scraped businesses list
- Check each business.placeId against list
- Set `isNew` and `alreadyScraped` flags
- Display appropriate badge

### 4. Add Filter Controls (1 hour)

**Update:** Dashboard results section (after extraction completes)

**Add filter toggle:**
```tsx
<div className="flex items-center gap-2">
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={showNewOnly}
      onChange={(e) => setShowNewOnly(e.target.checked)}
    />
    <span>Show new businesses only</span>
  </label>
  <Badge>{newCount} new, {scrapedCount} previously scraped</Badge>
</div>
```

**Update:** `/src/components/modals/lead-selection-modal.tsx`
- Pre-select only NEW businesses by default
- Gray out previously scraped businesses
- Add checkbox: "Include previously scraped" (unchecked by default)

### 5. Update Export Logic (30 min)

**Update:** Lead selection modal export buttons

**Changes:**
- Button text: "Send to Airtable (X new)"
- Button text: "Send to Quartz (X new)"
- Default behavior: Only export NEW businesses
- Add checkbox: "Include previously scraped businesses" (optional)
- Filter contacts array before sending to API:

```typescript
const contactsToSend = selectedBusinesses.filter(business => {
  if (includePreviouslyScraped) return true
  return business.isNew
})
```

### 6. Settings Panel (Optional - 15 min)

**Add to:** `/src/components/modals/settings-modal.tsx`

**New section:**
- Display: "Scraped Businesses: X total"
- Button: "View scraped businesses list" (opens modal with list)
- Button: "Clear scraped history" (with confirmation dialog)
- Optional: "Re-scrape businesses older than: [90 days]" setting

## Files to Create/Modify

### New Files:
1. `/data/scraped-businesses.json` - Master list storage (create empty: `{}`)
2. `/src/app/api/scraped-businesses/route.ts` - API endpoint for CRUD operations
3. `/src/lib/scraped-businesses.ts` - Helper functions (load, save, check, add)

### Modified Files:
1. `/src/components/dashboard/enhanced-review-extraction-dashboard.tsx` - Auto-tracking after extraction
2. `/src/components/cards/enhanced-business-card.tsx` - Visual badges (NEW/SEEN)
3. `/src/components/modals/lead-selection-modal.tsx` - Pre-selection logic, export filtering
4. `/src/components/results/results-table.tsx` - Filter toggle for table view
5. `/src/components/results/results-list.tsx` - Filter toggle for list view
6. `/src/components/modals/settings-modal.tsx` - Management UI (optional)

## User Workflow After Implementation

### Week 1: First Scrape
```
1. Scrape: tandarts Netherlands (businessLimit: 60)
2. Results: 60 businesses found
3. All businesses marked with 🆕 NEW badge
4. Export 60 new businesses to Airtable
5. System automatically adds 60 placeIds to scraped-businesses.json
```

### Week 3: Re-Scrape Same Category
```
1. Scrape: tandarts Netherlands (businessLimit: 60)
2. Results: 60 businesses found
   - 40 marked with 🔄 SEEN (overlap from Week 1)
   - 20 marked with 🆕 NEW (genuinely new businesses)
3. Toggle "Show new only" → See only 20 new businesses
4. Lead selection: Only 20 NEW businesses pre-selected
5. Export 20 new businesses to Airtable
6. System adds 20 new placeIds to scraped-businesses.json
```

### Week 5: Different Category
```
1. Scrape: car_dealer Netherlands (businessLimit: 50)
2. Results: 50 businesses found
3. All 50 marked as 🆕 NEW (different category, no overlap)
4. Export all 50 to Airtable
5. System adds 50 new placeIds to scraped-businesses.json
```

## Edge Cases & Considerations

### 1. Business Name Changed
**Scenario:** Business renamed but same placeId
**Handling:** Still detected as duplicate (placeId is permanent)
**Benefit:** Prevents contacting same business twice even after rename

### 2. Business Moved Location
**Scenario:** Business moved, new address but same placeId
**Handling:** Still detected as duplicate (placeId follows business)
**Benefit:** Same business = same owner = already contacted

### 3. Re-scrape After 6 Months
**Option A:** Manual clear of old entries via settings
**Option B:** Add "Re-scrape businesses older than X days" filter
**Implementation:** Check `firstScraped` date, ignore entries older than threshold

### 4. Wrong Category Scraped
**Scenario:** Accidentally scraped wrong category
**Handling:** All businesses still go into master list
**Benefit:** Still prevents duplicates across categories

### 5. Multiple Users (Future Multi-Tenant)
**Consideration:** Each user needs separate scraped-businesses list
**Implementation:** Store per-user: `/data/scraped-businesses-{userId}.json`
**Future-proof:** Design API to support userId parameter

## Data Persistence Strategy

### Current (Single User):
```
/data/scraped-businesses.json (simple JSON file)
```

### Future (Multi-Tenant):
```
PostgreSQL table:
CREATE TABLE scraped_businesses (
  id UUID PRIMARY KEY,
  user_id UUID,
  place_id VARCHAR UNIQUE,
  business_name VARCHAR,
  address TEXT,
  first_scraped TIMESTAMP,
  category VARCHAR,
  location VARCHAR
)
```

## Performance Considerations

### JSON File Approach (Current):
- **Pros:** Simple, no database needed, fast reads (<1ms for 10k entries)
- **Cons:** No concurrent writes, file size growth over time
- **Mitigation:** Monthly cleanup of entries >1 year old

### Database Approach (Future):
- **Pros:** Concurrent access, indexing, per-user isolation
- **Cons:** Requires database setup, slightly slower reads
- **When:** Move to DB when reaching 50k+ entries or multi-tenant

## Testing Checklist

- [ ] Create empty scraped-businesses.json file
- [ ] Run extraction, verify businesses added to list
- [ ] Run same extraction again, verify NEW/SEEN badges appear
- [ ] Test "Show new only" filter toggle
- [ ] Test lead selection pre-selects only NEW businesses
- [ ] Test export with "new only" option
- [ ] Test export with "include previously scraped" option
- [ ] Verify placeId uniqueness (no duplicates in JSON)
- [ ] Test with different categories
- [ ] Test with overlapping locations

## Estimated Time: 2-3 hours total

### Breakdown:
- Storage + API: 30 min
- Auto-tracking: 30 min
- Visual badges: 30 min
- Filter controls: 1 hour
- Export logic: 30 min
- Testing: 30 min

## Benefits Summary

✅ **Never contact same business twice** - Permanent tracking prevents duplicates
✅ **Clear visibility** - Instant visual feedback (NEW vs SEEN badges)
✅ **Efficient exports** - Only export genuinely new businesses
✅ **Credit savings** - Skip enrichment for already-scraped businesses
✅ **Simple workflow** - Automatic tracking, no manual marking needed
✅ **Customer intelligence** - Businesses that become customers tracked as "already contacted"

## Implementation Priority

**Phase 1 (Critical):** Steps 1-3 (Auto-tracking + Visual indicators)
**Phase 2 (Important):** Steps 4-5 (Filtering + Export logic)
**Phase 3 (Nice-to-have):** Step 6 (Settings management)

---

**Ready to implement when you are!**
