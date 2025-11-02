# Frontend Database Integration Guide

## 🎯 Current Status

Your frontend (running on port 3000) is **NOT YET** connected to the database cache system. Here's what's happening:

### What You Have:
1. ✅ **Database**: 5,216 businesses in PostgreSQL
2. ✅ **Optimized API**: `/api/extract-optimized` (uses database cache)
3. ✅ **Old API**: `/api/extract` (doesn't use cache - expensive!)
4. ❌ **Frontend**: Currently calling the OLD API

### Current Flow (EXPENSIVE):
```
Frontend → /api/extract → Apify API → $1.50 per search
```

### Target Flow (SAVES MONEY):
```
Frontend → /api/extract-optimized → PostgreSQL Cache → $0 per search (if cached)
                                  → Apify API → Only for missing businesses
```

---

## 🔧 What We're Adding

### 1. **Database Connection Indicator**
Shows real-time connection status in your UI:
- ✅ Green: Connected to database
- ❌ Red: Connection failed
- Shows: Total businesses, cache value, connection speed

### 2. **API Endpoint Selector (Settings)**
Let you choose which API to use:
- **Standard API** (`/api/extract`) - No caching, uses Apify for everything
- **Optimized API** (`/api/extract-optimized`) - Uses database cache first, saves money

### 3. **Cache Statistics Display**
Shows what's in your cache:
- Total businesses cached
- Cache value in dollars
- Top categories
- Top cities

---

## 📁 Files Created

### 1. Database Status API
**File**: `/src/app/api/database/status/route.ts`

**What it does**: Returns real-time database connection status and cache stats

**Test it:**
```bash
curl http://localhost:3000/api/database/status
```

**Response:**
```json
{
  "connected": true,
  "connection_time_ms": 45,
  "database": {
    "total_businesses": 5216,
    "total_categories": 139,
    "total_cities": 903,
    "cache_value_usd": "156.48"
  },
  "top_categories": [
    {"name": "Fysiotherapeut", "count": 2862},
    {"name": "Tandarts", "count": 1154}
  ],
  "top_cities": [
    {"name": "Amsterdam", "count": 619},
    {"name": "Almere", "count": 119}
  ]
}
```

### 2. Database Status Indicator Component
**File**: `/src/components/database/database-status-indicator.tsx`

**What it shows:**
- Real-time connection status
- Cache statistics
- Top categories and cities
- Auto-refreshes every 30 seconds

**Usage:**
```tsx
import { DatabaseStatusIndicator } from '@/components/database/database-status-indicator'

// Compact version (for header/navbar)
<DatabaseStatusIndicator compact />

// Full version (for dashboard)
<DatabaseStatusIndicator />
```

---

## 🚀 How to Connect Your Frontend

### Step 1: Add Database Indicator to Dashboard

Edit `/src/components/dashboard/enhanced-review-extraction-dashboard.tsx`:

```tsx
// Add to imports at top
import { DatabaseStatusIndicator } from '@/components/database/database-status-indicator'

// Add to dashboard layout (around line 700-800, near the header)
<div className="flex items-center gap-4 mb-6">
  <DatabaseStatusIndicator compact />
  {/* Your existing header components */}
</div>
```

### Step 2: Add API Endpoint Selector to Settings Modal

Edit `/src/components/modals/settings-modal.tsx`:

Add these state variables (around line 40):
```tsx
const [apiEndpoint, setApiEndpoint] = useState<'standard' | 'optimized'>('standard')

useEffect(() => {
  // Load API endpoint preference
  const savedEndpoint = localStorage.getItem('api_endpoint') as 'standard' | 'optimized'
  if (savedEndpoint) setApiEndpoint(savedEndpoint)
}, [isOpen])
```

Add this section in the modal (after scraped businesses section, around line 300):
```tsx
{/* API Endpoint Selection */}
<div className="space-y-4">
  <div className="flex items-center gap-2">
    <Database className="h-5 w-5 text-primary" />
    <h3 className="font-medium">API Endpoint</h3>
  </div>

  <div className="space-y-3">
    <div className="p-4 rounded-lg bg-muted/50">
      <Label htmlFor="api-endpoint">Extraction API</Label>
      <select
        id="api-endpoint"
        value={apiEndpoint}
        onChange={(e) => {
          const value = e.target.value as 'standard' | 'optimized'
          setApiEndpoint(value)
          localStorage.setItem('api_endpoint', value)
        }}
        className="w-full mt-2 p-2 rounded border bg-background"
      >
        <option value="standard">Standard API (No caching)</option>
        <option value="optimized">Optimized API (Uses database cache) ⭐</option>
      </select>

      {apiEndpoint === 'optimized' ? (
        <div className="mt-3 p-3 rounded bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-500 font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Cost Optimization Enabled
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Using database cache to minimize Apify costs. Expected savings: 60-80%
          </p>
        </div>
      ) : (
        <div className="mt-3 p-3 rounded bg-orange-500/10 border border-orange-500/20">
          <p className="text-sm text-orange-500 font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            No Cost Optimization
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Every search calls Apify directly. Switch to Optimized API to save money.
          </p>
        </div>
      )}
    </div>

    {/* Cache Statistics */}
    <DatabaseStatusIndicator />
  </div>
</div>
```

### Step 3: Update Extraction Function to Use Selected API

Edit `/src/components/dashboard/enhanced-review-extraction-dashboard.tsx`:

Find the `handleExtraction` function (around line 300) and update it:

```tsx
const handleExtraction = async (searchCriteria: SearchCriteria) => {
  // ... existing code ...

  // Get the selected API endpoint from localStorage
  const apiEndpoint = localStorage.getItem('api_endpoint') || 'standard'
  const apiUrl = apiEndpoint === 'optimized' ? '/api/extract-optimized' : '/api/extract'

  console.log(`Using API: ${apiUrl}`)

  try {
    const response = await fetch(apiUrl, {  // ← Changed from '/api/extract'
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Frontend-Request-Id': frontendRequestId
      },
      body: JSON.stringify(searchCriteria),
      signal: abortControllerRef.current?.signal
    })

    // ... rest of existing code ...
  }
}
```

---

## 🎨 Visual Examples

### Compact Indicator (Header)
```
🟢 Database | Connected
```
Hover shows:
```
✅ Connected (45ms)
📊 5,216 businesses
💰 $156.48 cache value
🏷️ 139 categories
🌍 903 cities
```

### Full Indicator (Dashboard)
```
┌─────────────────────────────────────┐
│ 💾 Database Cache                   │
│ ✅ Connected (45ms)          Refresh│
│                                     │
│ Businesses  Categories  Cities  Value│
│   5,216        139       903    $156│
│                                     │
│ Top Categories:                     │
│ Fysiotherapeut          2,862       │
│ Tandarts                1,154       │
│                                     │
│ Top Cities:                         │
│ Amsterdam                 619       │
│ Almere                    119       │
└─────────────────────────────────────┘
```

---

## ⚙️ Settings Modal - API Selection

```
╔═══════════════════════════════════════╗
║ ⚙️  Settings                           ║
╠═══════════════════════════════════════╣
║                                       ║
║ 💾 API Endpoint                       ║
║                                       ║
║ Extraction API                        ║
║ [Optimized API (Uses database cache)▼]║
║                                       ║
║ ┌─────────────────────────────────┐  ║
║ │ ✅ Cost Optimization Enabled    │  ║
║ │ Using database cache to minimize│  ║
║ │ Apify costs. Expected savings:  │  ║
║ │ 60-80%                          │  ║
║ └─────────────────────────────────┘  ║
║                                       ║
║ [Database Cache Statistics Card]      ║
║                                       ║
╚═══════════════════════════════════════╝
```

---

## 🧪 Testing Your Setup

### 1. Check Database Connection
```bash
# Open your browser to http://localhost:3000
# You should see the database indicator in the header

# Or test the API directly:
curl http://localhost:3000/api/database/status
```

### 2. Test Optimized API
```bash
# In settings, select "Optimized API"
# Then run an extraction for Amsterdam dentists
# You should see in the results:
# - "cached": 10+ (businesses from cache)
# - "savings_usd": $0.30+ (money saved)
```

### 3. Compare Costs
```
Standard API:
  Search: Amsterdam dentists (20 businesses)
  Cost: $0.60 (20 × $0.03)
  All from Apify

Optimized API:
  Search: Amsterdam dentists (20 businesses)
  Cost: $0.00 (all from cache!)
  Savings: $0.60 per search
```

---

## 💡 Pro Tips

### 1. **Always Use Optimized API in Production**
The standard API is only useful for:
- Testing
- When you WANT to force fresh data
- When cache doesn't have what you need

### 2. **Monitor Cache Hit Rate**
In your extraction results, look for:
```json
{
  "cost": {
    "cache_hit_rate": "85.0%"  // ← Higher is better!
  }
}
```

### 3. **Cache Grows Automatically**
Every search adds new businesses to cache, making future searches cheaper.

---

## 🐛 Troubleshooting

### Database indicator shows "Disconnected"
**Check:**
1. Is `npm run dev` running?
2. Check `.env.local` has correct database credentials
3. Run: `node database/show-my-cache.js` to test connection

### Optimized API returns 0 results
**Check:**
1. Database has businesses in that category/city
2. Run: `curl http://localhost:3000/api/database/status` to see what's cached
3. Try with Standard API first to populate cache

### Still seeing high Apify costs
**Check:**
1. Settings modal shows "Optimized API" selected
2. Browser console shows: "Using API: /api/extract-optimized"
3. Results show `"cached": > 0`

---

## 📊 Expected Savings (Real Numbers)

### With Your Current Cache (5,216 businesses):

| Scenario | Without Cache | With Cache (85% hit) | Savings |
|----------|--------------|---------------------|---------|
| **Single Search** | $1.50 | $0.00-$0.30 | $1.20-$1.50 |
| **100 Searches** | $150 | $22.50 | **$127.50** |
| **1,000 Searches** | $1,500 | $225 | **$1,275** |
| **Annual (12k searches)** | $18,000 | $2,700 | **$15,300** |

---

## ✅ Quick Start Checklist

- [ ] Database is running and has 5,216 businesses
- [ ] API endpoint `/api/database/status` returns connection status
- [ ] Database indicator component created
- [ ] Settings modal updated with API selector
- [ ] Extraction function updated to use selected API
- [ ] Tested with Optimized API selected
- [ ] Verified cache hit rate > 0%
- [ ] Documented expected savings

---

## 🚀 Next Steps

1. **Add the indicator to your dashboard** (5 minutes)
2. **Update settings modal** with API selector (10 minutes)
3. **Update extraction function** to use selected API (5 minutes)
4. **Test with Amsterdam dentists** (should be 100% cached)
5. **Monitor savings** in your extraction results

Your frontend will then be **fully integrated** with the database cache system! 🎉
