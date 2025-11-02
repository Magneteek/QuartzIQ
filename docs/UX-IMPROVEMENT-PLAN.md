# QuartzIQ UX Improvement Plan
## Two-Phase Workflow Enhancement

### Current Problem

The current UX is confusing because it doesn't clearly show the two-phase workflow:

1. **Phase 1 (Business Discovery)**: Find/import businesses → Cache in database
2. **Phase 2 (Review Extraction)**: Scan cached businesses → Find qualifying reviews → Save to Contact Vault

**User Confusion Points:**
- ❌ Imported businesses don't appear in Contact Vault (they're just cached)
- ❌ No clear way to run review extraction on cached businesses
- ❌ Workflow feels disconnected

### Proposed Solution: Unified Dashboard with Clear Phases

## Option 1: Two-Step Wizard (RECOMMENDED)

```
┌─────────────────────────────────────────────────────┐
│  📍 STEP 1: Find Businesses                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ○ Search New Businesses                            │
│     Category: [________]  Location: [________]      │
│     [🔍 Search & Cache]                             │
│                                                      │
│  ○ Use Cached Businesses                            │
│     [📦 380 businesses in database]                 │
│     Filter: Category [All ▼] Location [All ▼]      │
│     [✓ Select All] [Select 127 matching]           │
│                                                      │
│  ○ Import from Apify                                │
│     Dataset ID: [________]                          │
│     [📥 Import & Cache]                             │
│                                                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  📝 STEP 2: Extract Qualifying Reviews              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Selected: 127 businesses                           │
│                                                      │
│  Review Criteria:                                   │
│  Max Stars: [3 ▼]   Days Back: [14 ▼]             │
│  Max Reviews/Business: [5 ▼]                        │
│                                                      │
│  [🚀 Extract Reviews from 127 Businesses]           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Clear two-phase workflow
- ✅ Can use cached businesses OR search new ones
- ✅ Import Apify datasets directly
- ✅ Visual selection of cached businesses

## Option 2: Tabs-Based Interface

```
┌─────────────────────────────────────────────────────┐
│  [🔍 Search] [📦 Cached] [📥 Import]               │
├─────────────────────────────────────────────────────┤
│                                                      │
│  TAB 1: SEARCH                                      │
│  Search for new businesses on Google Maps           │
│  Category: [________]  Location: [________]         │
│  [🔍 Search & Cache]                                │
│                                                      │
│  TAB 2: CACHED (380 businesses)                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ ☑ Insurance Amsterdam (174)                  │  │
│  │ ☑ Dentist Rotterdam (94)                     │  │
│  │ ☑ Real Estate Utrecht (19)                   │  │
│  └──────────────────────────────────────────────┘  │
│  [🚀 Extract Reviews from Selected]                 │
│                                                      │
│  TAB 3: IMPORT                                      │
│  Import from Apify datasets                         │
│  Dataset IDs: [________]                            │
│  [📥 Import & Cache]                                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Three clear entry points
- ✅ Easy to understand
- ✅ Flexible workflow

## Option 3: Smart Search with Auto-Detection (SIMPLEST)

```
┌─────────────────────────────────────────────────────┐
│  🔍 Business Search & Review Extraction              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Category: [insurance        ▼]                     │
│  Location: [Amsterdam        ▼]                     │
│                                                      │
│  💡 Smart Detection:                                │
│  ┌──────────────────────────────────────────────┐  │
│  │ ✅ Found 174 cached businesses                │  │
│  │    ○ Use cached (instant, $0)                │  │
│  │    ○ Search new ($0.50)                      │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  Review Criteria:                                   │
│  Max Stars: [3 ▼]   Days: [14 ▼]                   │
│                                                      │
│  [🚀 Extract Reviews]                               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Simplest UX - single form
- ✅ Auto-detects cached businesses
- ✅ Shows cost savings
- ✅ One-click extraction

## Recommended Implementation: Hybrid Approach

**Combine Option 3 (Smart Search) + Quick Actions**

```
┌─────────────────────────────────────────────────────┐
│  🔍 Business & Review Extraction                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [🔍 Search] [📦 Cached (380)] [📥 Import Apify]   │
│                                                      │
│  Category: [insurance        ▼]                     │
│  Location: [Amsterdam        ▼]                     │
│                                                      │
│  💡 174 businesses already cached!                  │
│  ┌──────────────────────────────────────────────┐  │
│  │ [✓ Use Cached ($0)]  [ Search New ($0.50)]  │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  Review Criteria:                                   │
│  Max Stars: [≤3 ⭐]   Days: [14]   Per Business: [5] │
│                                                      │
│  [🚀 Extract Reviews from 174 Businesses]           │
│                                                      │
│  Quick Actions:                                     │
│  • [📥 Import Apify Dataset]                        │
│  • [📊 View All Cached (380)]                       │
│  • [🗑️ Clear Cache]                                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Backend Changes

1. **Add Cache Detection API** (`/api/check-cache`)
   - Input: category, location
   - Output: count, sample businesses, cost comparison

2. **Modify Extract API**
   - Support `useCached: true` flag
   - Skip Apify when using cached businesses

3. **Add Bulk Extraction Endpoint** (`/api/extract-from-cache`)
   - Input: array of place IDs
   - Output: extraction results

### Phase 2: Frontend Components

1. **CacheDetectionBanner Component**
   ```tsx
   <CacheDetectionBanner
     category="insurance"
     location="Amsterdam"
     cachedCount={174}
     onUseCached={() => setUseCached(true)}
     onSearchNew={() => setUseCached(false)}
   />
   ```

2. **QuickActionButtons Component**
   ```tsx
   <QuickActionButtons
     onImportApify={() => setShowImportModal(true)}
     onViewCached={() => setShowCachedModal(true)}
     cachedCount={380}
   />
   ```

3. **Update EnhancedSearchForm**
   - Add cache detection logic
   - Show cached vs new business options
   - Display cost comparison

### Phase 3: New Modals

1. **ImportApifyModal**
   - Paste dataset IDs
   - Bulk import
   - Show import progress

2. **CachedBusinessesModal**
   - Browse all cached businesses
   - Filter by category/location
   - Select for extraction
   - Bulk delete

### Phase 4: UX Polish

1. **Visual Indicators**
   - 💾 Icon for cached businesses
   - 🆕 Icon for new searches
   - 💰 Cost savings badges

2. **Progress Tracking**
   - Import progress bar
   - Extraction progress for cached businesses
   - Success animations

3. **Helpful Messages**
   - "Using 174 cached businesses - saving $0.50!"
   - "No cached businesses found - searching Google Maps..."
   - "Import complete! Ready to extract reviews."

## User Flow Examples

### Flow 1: Use Cached Businesses
1. User enters category + location
2. System detects 174 cached businesses
3. Shows banner: "Use cached (instant) or search new ($0.50)"
4. User clicks "Use Cached"
5. Sets review criteria
6. Clicks "Extract Reviews"
7. Results appear in Contact Vault

### Flow 2: Import Apify Dataset
1. User clicks "Import Apify" quick action
2. Pastes dataset ID
3. System imports & caches businesses
4. Shows success: "174 businesses imported"
5. User proceeds to extraction (Flow 1)

### Flow 3: Search New Businesses
1. User enters category + location
2. System shows: "No cached businesses"
3. User clicks "Search"
4. Apify finds & caches businesses
5. Immediately proceeds to review extraction
6. Results in Contact Vault

## Database Changes Needed

### New Table: `business_cache_stats`
```sql
CREATE TABLE business_cache_stats (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  category VARCHAR(255),
  location VARCHAR(255),
  business_count INTEGER,
  last_updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Index Optimizations
```sql
CREATE INDEX idx_businesses_category_location
ON businesses(category, city);

CREATE INDEX idx_businesses_organization
ON businesses(organization_id, category, city);
```

## Cost Savings Display

```
┌─────────────────────────────────────┐
│  💰 Cost Comparison                 │
├─────────────────────────────────────┤
│  Search New:    $0.50 (200 credits) │
│  Use Cached:    $0.00               │
│  ─────────────────────────────      │
│  Savings:       $0.50 (100%)        │
└─────────────────────────────────────┘
```

## Success Metrics

- ✅ Users understand cached vs new search
- ✅ 80% cost savings through cache usage
- ✅ <5 second workflow completion for cached businesses
- ✅ Clear visual feedback at each step
- ✅ Zero user confusion about "where did my data go"

---

**Next Steps:**
1. Decide on preferred UX approach
2. Implement backend cache detection
3. Build frontend components
4. Test with real user workflows
5. Add analytics tracking
