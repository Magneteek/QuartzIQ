# How to Use Your Business Cache System

## 🎯 What You Have Now

You have **5,216 businesses** cached in your PostgreSQL database with:
- Business names and addresses
- Google placeIDs (the expensive part - $0.03 each)
- Ratings and review counts
- Phone numbers and websites
- Categories and locations

## 💰 How It Saves Money

### The Problem
Apify charges $0.03 per business to get their Google placeID. If you search for 50 dentists in Amsterdam:
- **Cost:** 50 businesses × $0.03 = **$1.50 per search**
- 1,000 searches/month = **$1,500/month**

### The Solution
Your cache stores placeIDs from previous searches. When someone searches for Amsterdam dentists:
1. System checks PostgreSQL cache first
2. Finds 2,000+ Amsterdam dentists already cached
3. Returns them instantly - **$0 cost**
4. Only calls Apify if you need businesses NOT in cache

**Result:** 85% cache hit rate = **$225/month** instead of $1,500/month

---

## 🚀 How to Access the Cache

### Method 1: Via Optimized API (Recommended)

This is the **main way** to use your cache. The API automatically:
1. Checks cache first
2. Returns cached businesses if found
3. Only calls Apify for missing businesses
4. Shows you cost savings

#### Example API Request:

```bash
curl -X POST http://localhost:3000/api/extract-optimized \
  -H "X-API-Key: quartziq_1236e22634e48db6b08754f0a6dd5f40dac1a28cb8067fdbf2e0faaee86ffae5" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "tandarts",
    "location": "Amsterdam",
    "businessLimit": 20,
    "maxReviewStars": 3,
    "dayLimit": 14
  }'
```

#### Example Response:

```json
{
  "success": true,
  "businesses": {
    "total": 20,
    "cached": 18,    // ← 18 came from cache ($0)
    "new": 2,        // ← 2 fetched from Apify ($0.06)
    "list": [
      {
        "id": "uuid...",
        "name": "Tandarts Amsterdam Centrum",
        "place_id": "ChIJ...",
        "address": "Dam 1, 1012 JS Amsterdam",
        "city": "Amsterdam",
        "rating": 4.5,
        "reviews_count": 120,
        "phone": "+31 20 123 4567",
        "website": "https://example.com"
      }
      // ... 19 more businesses
    ]
  },
  "reviews": {
    "total": 45,
    "cached": 30,
    "new": 15
  },
  "cost": {
    "apify_credits_used": 0.06,
    "apify_cost_usd": 0.06,
    "savings_usd": 0.54,           // ← Saved $0.54 on this request!
    "cache_hit_rate": "90.0%"      // ← 90% came from cache
  },
  "performance": {
    "duration_ms": 2500,
    "duration_seconds": "2.5"
  }
}
```

**See the savings?** Instead of $0.60 (20 × $0.03), you only paid $0.06 (2 × $0.03)!

---

### Method 2: Direct Database Queries (For Analysis)

If you want to explore what's in your cache directly:

#### Check What Categories You Have:

```javascript
// /database/check-cache-categories.js
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
  // Get all categories with counts
  const result = await pool.query(`
    SELECT category, COUNT(*) as count
    FROM businesses
    GROUP BY category
    ORDER BY count DESC
    LIMIT 20
  `);

  console.log('Categories in cache:');
  result.rows.forEach(r => {
    console.log(`  ${r.category}: ${r.count} businesses`);
  });

  await pool.end();
})();
```

Run it:
```bash
cd database
node check-cache-categories.js
```

#### Search for Specific Businesses:

```javascript
// /database/search-cache.js
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
  // Search for Amsterdam dentists
  const result = await pool.query(`
    SELECT name, address, city, rating, reviews_count
    FROM businesses
    WHERE city ILIKE '%Amsterdam%'
      AND category ILIKE '%tandarts%'
    ORDER BY rating DESC
    LIMIT 10
  `);

  console.log('Top 10 Amsterdam Dentists:');
  result.rows.forEach((b, idx) => {
    console.log(`${idx + 1}. ${b.name} (${b.rating}★, ${b.reviews_count} reviews)`);
    console.log(`   ${b.address}`);
  });

  await pool.end();
})();
```

---

## 📊 What's Actually Cached

### You Have 5,216 Businesses Including:

**Amsterdam Dentists (~2,000)**
- Tandarts (Dentist)
- Cosmetische tandarts (Cosmetic dentist)
- Tandheelkundige kliniek (Dental clinic)
- Parodontoloog (Periodontist)
- Kaakchirurg (Oral surgeon)
- Orthodontist
- Kindertandarts (Pediatric dentist)

**Netherlands Physiotherapists (~2,800)**
- Fysiotherapeut (Physiotherapist)
- Fysiotherapiepraktijk (Physiotherapy practice)

**Other Healthcare (~400)**
- Personal trainers
- Massage therapists
- Medical centers
- Psychologists
- Etc.

### Geographic Coverage:
- **903 cities** across the Netherlands
- **6 countries** (NL, BE, DE, etc.)

---

## 🔄 Real-World Usage Example

### Scenario: User wants to analyze Amsterdam dentists with bad reviews

```javascript
// Your frontend or backend code
const response = await fetch('http://localhost:3000/api/extract-optimized', {
  method: 'POST',
  headers: {
    'X-API-Key': 'quartziq_1236e22634e48db6b08754f0a6dd5f40dac1a28cb8067fdbf2e0faaee86ffae5',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    category: 'tandarts',
    location: 'Amsterdam',
    businessLimit: 50,
    maxReviewStars: 3,  // Only reviews 3★ or lower
    dayLimit: 14        // Reviews from last 14 days
  })
});

const data = await response.json();

// Results:
console.log(`Found ${data.businesses.total} businesses`);
console.log(`${data.businesses.cached} came from cache (free!)`);
console.log(`${data.businesses.new} fetched from Apify`);
console.log(`Saved: $${data.cost.savings_usd}`);
console.log(`Total reviews: ${data.reviews.total}`);

// Process the businesses
data.businesses.list.forEach(business => {
  console.log(`${business.name}: ${business.rating}★`);
  // Send to your CRM, export to CSV, etc.
});
```

**Output:**
```
Found 50 businesses
48 came from cache (free!)
2 fetched from Apify
Saved: $1.44
Total reviews: 127
```

---

## 🎯 When Cache Is Used vs. Apify

### Cache IS Used (Free - $0):
✅ Amsterdam dentists → 2,000+ in cache
✅ Emmen physiotherapists → 24 in cache
✅ Any business you've searched before

### Apify IS Called (Costs Money):
❌ Rotterdam dentists → Not in cache yet
❌ Utrecht restaurants → Not in cache yet
❌ Any new location/category

**But**: After the first search, it gets cached for future use!

---

## 📈 Monitoring Cache Performance

### Check Cache Hit Rate:

```javascript
// /database/cache-stats.js
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
  // Get recent extractions
  const result = await pool.query(`
    SELECT
      COUNT(*) as total_extractions,
      SUM(businesses_found) as total_businesses,
      SUM(cached_businesses) as total_cached,
      SUM(new_businesses) as total_new,
      ROUND(AVG(CAST(cached_businesses AS FLOAT) / NULLIF(businesses_found, 0) * 100), 1) as avg_cache_hit_rate
    FROM extractions
    WHERE started_at >= NOW() - INTERVAL '7 days'
  `);

  const stats = result.rows[0];
  console.log('Last 7 Days Cache Performance:');
  console.log(`  Total extractions: ${stats.total_extractions}`);
  console.log(`  Total businesses: ${stats.total_businesses}`);
  console.log(`  From cache: ${stats.total_cached}`);
  console.log(`  From Apify: ${stats.total_new}`);
  console.log(`  Avg cache hit rate: ${stats.avg_cache_hit_rate}%`);

  await pool.end();
})();
```

---

## 🔑 Your API Keys

You have **3 organization API keys**:

1. **QuartzIQ:** `quartziq_1236e22634e48db6b08754f0a6dd5f40dac1a28cb8067fdbf2e0faaee86ffae5`
2. **TestOrg:** `testorg_9a7b2c8d4e1f3a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b`
3. **DemoClient:** `democlient_5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e`

Use them in the `X-API-Key` header for all API requests.

---

## ⚡ Quick Start Commands

### 1. Test if Cache is Working:

```bash
# From project root
curl -X POST http://localhost:3000/api/extract-optimized \
  -H "X-API-Key: quartziq_1236e22634e48db6b08754f0a6dd5f40dac1a28cb8067fdbf2e0faaee86ffae5" \
  -H "Content-Type: application/json" \
  -d '{"category":"tandarts","location":"Amsterdam","businessLimit":10}'
```

Look for:
- `"cached": 10` (or close to 10) = Cache is working! 🎉
- `"savings_usd": ...` = Money saved

### 2. See What's in Your Cache:

```bash
cd database
node test-cache-search-v2.js
```

### 3. Check Cache Statistics:

```bash
cd database
node -e "
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env.local' });
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});
(async () => {
  const r = await pool.query('SELECT COUNT(*) as total FROM businesses');
  console.log('Total businesses in cache:', r.rows[0].total);
  await pool.end();
})();
"
```

---

## 💡 Pro Tips

### 1. **Cache Grows Automatically**
Every time you search for NEW businesses, they get added to cache automatically!

### 2. **Force Refresh**
If you want fresh data (ignore cache):
```json
{
  "category": "tandarts",
  "location": "Amsterdam",
  "forceRefresh": true  // ← Bypasses cache
}
```

### 3. **Check Before Using**
If you're not sure if something is cached, check first:
```bash
cd database
node -e "
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env.local' });
const pool = new Pool({...});
(async () => {
  const r = await pool.query(\`
    SELECT COUNT(*) FROM businesses
    WHERE city ILIKE '%Rotterdam%'
    AND category ILIKE '%tandarts%'
  \`);
  console.log('Rotterdam dentists in cache:', r.rows[0].count);
  await pool.end();
})();
"
```

---

## 📞 Support

If something isn't working:

1. **Check Dev Server**: `npm run dev` (must be running)
2. **Check Database Connection**: See `.env.local` credentials
3. **Check API Key**: Make sure you're using the correct one
4. **Check Logs**: Look at terminal where dev server is running

---

## 🎯 Summary

**What you have:** A PostgreSQL database with 5,216 cached businesses

**How to use it:** Call the `/api/extract-optimized` endpoint with your API key

**What it does:** Returns cached businesses (free) + fetches missing ones (costs money)

**Why it matters:** Saves $1,275/month (85% cache hit rate) = **$15,300/year**

**How to access:**
- Via API: Use the endpoint (recommended)
- Via Database: Direct SQL queries (for analysis)

You're now set up to save significant money on every extraction! 🚀💰
