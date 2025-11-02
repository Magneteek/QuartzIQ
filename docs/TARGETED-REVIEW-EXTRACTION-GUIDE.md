# 🎯 TARGETED REVIEW EXTRACTION FROM CACHED BUSINESSES

## 💡 Concept Overview

**Instead of searching for businesses AND extracting reviews (expensive), use cached business listings to extract only reviews (much cheaper).**

### Cost Comparison

| Approach | Business Search | Review Extraction | Total Cost | Use Case |
|----------|----------------|-------------------|------------|----------|
| **Full Extraction** | $0.05 | $0.02 × N | $0.05 + ($0.02 × N) | First time extraction |
| **Targeted (Cache)** | $0.00 ✅ | $0.02 × N | $0.02 × N | Re-extract reviews from known businesses |
| **Savings** | 💵 **100%** | - | **~50-70%** | Especially powerful with large datasets |

**Example**: Extracting reviews from 20 Amsterdam dentists:
- Full extraction: $0.05 + ($0.02 × 20) = **$0.45**
- Targeted extraction: $0.00 + ($0.02 × 20) = **$0.40**
- **Savings: $0.05 per extraction (11%)**

The savings increase dramatically with more businesses:
- 50 businesses: Save $0.05 (5%)
- 100 businesses: Save $0.05 (2.5%)

---

## 🗄️ Your Database Cache

Current cache status (as of system):
```
Total Businesses: 5,216
Total Categories: 139
Total Cities: 903
Cache Value: $156.48 USD

Top Categories:
├─ Fysiotherapeut: 2,862 businesses
├─ Tandarts: 1,154 businesses ⭐
└─ Tandartspraktijk: 388 businesses

Top Cities:
├─ Amsterdam: 619 businesses ⭐
├─ Almere: 119 businesses
└─ Utrecht: 99 businesses
```

---

## 🚀 Quick Start Guide

### Step 1: Check What's Cached

**Preview what businesses are available for extraction:**

```bash
node preview-cached-businesses.js [category] [city] [maxRating] [limit]
```

**Examples:**

```bash
# Amsterdam dentists with rating ≤4.6 (first 10)
node preview-cached-businesses.js tandarts Amsterdam 4.6 10

# Rotterdam physiotherapists
node preview-cached-businesses.js fysiotherapeut Rotterdam 4.8 20

# All Amsterdam restaurants
node preview-cached-businesses.js restaurant Amsterdam 5.0 50
```

**Output Example:**
```
✅ Found 10 cached businesses

1. Aqua Dental Clinic Tandarts Amsterdam
   Rating: ⭐ 1.0 | Reviews: 1
   Address: Piet Heinkade 215, 1019 HM Amsterdam
   Place ID: ChIJ2e1uGysJxkcRJdtblr79_O8

... (9 more)

💰 COST ESTIMATE:
   Review extraction: $0.20 (10 × $0.02)
   Full extraction: $0.25
   💵 Savings by using cache: $0.05 (20.0%)
```

### Step 2: Start Development Server

**Required for API-based extraction:**

```bash
cd /Users/kris/CLAUDEtools/QuartzIQ
npm run dev
```

Keep this running in a separate terminal.

### Step 3: Extract Reviews

**Option A: Simple API Call (Recommended)**

```bash
node extract-from-cache-simple.js [category] [location] [businessLimit]
```

**Examples:**

```bash
# Extract from 5 Amsterdam dentists (testing)
node extract-from-cache-simple.js tandarts Amsterdam 5

# Extract from 20 Amsterdam dentists (production)
node extract-from-cache-simple.js tandarts Amsterdam 20

# Extract from 10 Rotterdam physiotherapists
node extract-from-cache-simple.js fysiotherapeut Rotterdam 10
```

**Output Example:**
```
🚀 TARGETED REVIEW EXTRACTION FROM CACHE

⚙️  Configuration:
{
  "category": "tandarts",
  "location": "Amsterdam",
  "businessLimit": 5,
  "maxReviewStars": 3,
  "dayLimit": 30,
  "maxReviewsPerBusiness": 10
}

🔄 Calling optimized API endpoint...
⏳ Waiting for extraction to complete...

...........

✅ Request completed

═══════════════════════════════════════════════════════
📊 EXTRACTION RESULTS
═══════════════════════════════════════════════════════

✅ SUCCESS!

📋 Summary:
   Businesses found: 5
   Reviews extracted: 23
   Negative reviews (≤3★): 18
   Duration: 47.3s

💾 Cache Performance:
   Businesses cached: 5
   Businesses new: 0
   Cache hit rate: 100.0%

💰 Cost Breakdown:
   Business search: $0.00 (cached! 🎉)
   Review extraction: $0.10
   Total cost: $0.10
   💵 Savings: $0.05 (33%)

📋 Businesses Processed:
   1. Aqua Dental Clinic Tandarts Amsterdam
      Rating: ⭐ 1.0★
      Address: Piet Heinkade 215, 1019 HM Amsterdam
      Reviews extracted: 1 (1 negative)

   ... (4 more)

═══════════════════════════════════════════════════════

✅ Extraction complete! Reviews are cached in the database.
```

---

## 📖 Advanced Usage

### Custom Configuration

Edit the scripts to customize extraction parameters:

**`extract-from-cache-simple.js` Configuration:**

```javascript
const CONFIG = {
  category: 'tandarts',           // Business category
  location: 'Amsterdam',          // City/region
  businessLimit: 5,               // Number of businesses to process
  maxReviewStars: 3,              // Only reviews ≤3 stars
  dayLimit: 30,                   // Reviews from last 30 days
  maxReviewsPerBusiness: 10,      // Max reviews per business
};
```

**Common Adjustments:**

```javascript
// Extract ALL negative reviews (1-3 stars), last 60 days
{
  maxReviewStars: 3,
  dayLimit: 60,
  maxReviewsPerBusiness: 20
}

// Extract only VERY negative reviews (1-2 stars), last 14 days
{
  maxReviewStars: 2,
  dayLimit: 14,
  maxReviewsPerBusiness: 5
}

// Extract mixed reviews (1-4 stars), last 90 days
{
  maxReviewStars: 4,
  dayLimit: 90,
  maxReviewsPerBusiness: 15
}
```

### Batch Processing

**Process businesses in batches to avoid rate limits:**

```bash
# Batch 1: First 10 businesses
node extract-from-cache-simple.js tandarts Amsterdam 10

# Wait 2 minutes

# Batch 2: Next 10 businesses (adjust filters if needed)
node extract-from-cache-simple.js tandarts Amsterdam 10
```

---

## 🛠️ Troubleshooting

### Issue: "Connection Refused"

**Solution:** Make sure the dev server is running:

```bash
npm run dev
```

### Issue: "No businesses found"

**Solution:** Check what's actually cached:

```bash
node preview-cached-businesses.js tandarts Amsterdam 5.0 100
```

Adjust category/city based on what you see in cache.

### Issue: "Timeout after 5 minutes"

**Solution:** Reduce `businessLimit` or `maxReviewsPerBusiness`:

```bash
# Instead of 50 businesses:
node extract-from-cache-simple.js tandarts Amsterdam 50

# Try 20 businesses:
node extract-from-cache-simple.js tandarts Amsterdam 20
```

### Issue: "Apify 403 Errors"

**Check your Apify credits:**

1. Visit: https://console.apify.com/billing
2. Check remaining credits
3. Upgrade plan if needed

**Fallback:** The system will use cached reviews when Apify fails, so partial data is still returned.

---

## 📊 Cost Optimization Strategies

### Strategy 1: Prioritize High-Value Targets

**Extract from businesses with most reviews first:**

```bash
# Preview sorts by reviews_count DESC
node preview-cached-businesses.js tandarts Amsterdam 4.6 100
```

Top businesses = more reviews = more insights

### Strategy 2: Time-Based Filtering

**Only extract recent reviews to save API calls:**

```javascript
// Last 14 days only (fewer reviews = lower cost)
{
  dayLimit: 14,
  maxReviewsPerBusiness: 5
}
```

### Strategy 3: Incremental Updates

**Extract reviews weekly instead of daily:**

1. Week 1: Extract last 7 days
2. Week 2: Extract last 7 days (only new reviews charged)
3. System automatically deduplicates in database

### Strategy 4: Location Clustering

**Group extractions by city to maximize cache hits:**

```bash
# Good: City-specific
node extract-from-cache-simple.js tandarts Amsterdam 20

# Less efficient: Multiple cities (separate calls)
node extract-from-cache-simple.js tandarts Rotterdam 10
node extract-from-cache-simple.js tandarts Utrecht 10
```

---

## 🎯 Common Use Cases

### Use Case 1: Reputation Monitoring

**Monitor Amsterdam dentists for new negative reviews:**

```bash
# Daily monitoring: Extract last 7 days, ≤3 stars
node extract-from-cache-simple.js tandarts Amsterdam 50
```

Cost: ~$1.00/day (50 businesses × $0.02)
Monthly: ~$30.00

### Use Case 2: Competitive Analysis

**Track competitor reviews across multiple cities:**

```bash
# Amsterdam competitors
node extract-from-cache-simple.js tandarts Amsterdam 20

# Rotterdam competitors
node extract-from-cache-simple.js tandarts Rotterdam 20
```

Cost: $0.80 total (40 businesses × $0.02)

### Use Case 3: Lead Generation

**Find businesses with recent complaints:**

```bash
# Very negative reviews only (1-2 stars), last 30 days
# Edit CONFIG: maxReviewStars: 2, dayLimit: 30
node extract-from-cache-simple.js tandarts Amsterdam 100
```

Cost: $2.00 (100 businesses × $0.02)
Potential leads: 20-30 businesses with recent issues

---

## 📈 Performance Metrics

### Typical Extraction Times

| Businesses | Reviews per Business | Total Time | Cost |
|------------|---------------------|------------|------|
| 5 | 5-10 | 30-60s | $0.10 |
| 10 | 5-10 | 1-2 min | $0.20 |
| 20 | 5-10 | 2-3 min | $0.40 |
| 50 | 5-10 | 5-8 min | $1.00 |
| 100 | 5-10 | 10-15 min | $2.00 |

**Factors affecting speed:**
- Apify API response time
- Number of reviews per business
- Network latency
- Database write speed

---

## 🔒 Best Practices

### 1. **Start Small, Scale Up**

```bash
# Test with 5 businesses first
node extract-from-cache-simple.js tandarts Amsterdam 5

# If successful, scale to 20
node extract-from-cache-simple.js tandarts Amsterdam 20
```

### 2. **Monitor Cache Hit Rates**

**Look for "Cache hit rate: 100.0%" in output**

If < 100%, some businesses aren't cached. Those will be expensive.

### 3. **Regular Database Backups**

```bash
# Backup before large extractions
pg_dump quartziq_reviews > backup_$(date +%Y%m%d).sql
```

### 4. **Review Deduplication**

Database automatically prevents duplicate reviews using `review_hash`.

No need to worry about extracting same reviews multiple times.

### 5. **Cost Tracking**

**Log all extractions:**

```bash
# Append to cost log
echo "$(date): $0.40 - 20 Amsterdam dentists" >> extraction_costs.log
```

---

## 🚨 Known Limitations

### 1. **Cache Staleness**

Cached businesses may have outdated information:
- Rating changes not reflected
- Business closures not detected
- New businesses not included

**Solution:** Refresh cache quarterly with full extraction

### 2. **Review Freshness**

Only extracts reviews from last N days (configurable).

Older reviews require increasing `dayLimit`.

### 3. **API Rate Limits**

Apify has rate limits. Avoid extracting > 100 businesses simultaneously.

**Recommended:** Process in batches of 20-50.

### 4. **Place ID Accuracy**

Google sometimes changes place IDs. If extraction fails:
- Business may have been merged
- Business may be permanently closed
- Place ID may be invalid

**Solution:** Re-run full extraction to refresh place IDs

---

## 💡 Pro Tips

### Tip 1: Combine with Frontend

**Use the frontend to visualize extracted reviews:**

1. Extract reviews: `node extract-from-cache-simple.js ...`
2. Open frontend: `http://localhost:3000`
3. View results in dashboard

### Tip 2: Export for Analysis

**After extraction, export to Excel:**

1. Frontend → Export → Excel
2. Analyze in spreadsheets
3. Share with team

### Tip 3: Automate with Cron

**Schedule daily extractions:**

```bash
# Add to crontab
0 9 * * * cd /Users/kris/CLAUDEtools/QuartzIQ && node extract-from-cache-simple.js tandarts Amsterdam 50
```

Runs daily at 9 AM, monitors 50 Amsterdam dentists.

### Tip 4: Multi-Language Support

**System auto-detects language:**

```bash
# Dutch reviews
node extract-from-cache-simple.js tandarts Amsterdam 20

# Works with any language
node extract-from-cache-simple.js dentist "New York" 20
```

---

## 📚 Related Documentation

- `FINAL-STATUS.md` - System status and capabilities
- `SESSION-SUMMARY-COMPLETE.md` - Recent improvements
- `UI-IMPROVEMENTS-COMPLETE.md` - Frontend features
- `CATEGORY-TRANSLATION-COMPLETE.md` - Multi-language support
- `APIFY-ERROR-HANDLING-COMPLETE.md` - Error handling details

---

## 🆘 Support

**Issues? Questions?**

1. Check `/Users/kris/CLAUDEtools/QuartzIQ/README.md`
2. Review error logs in console
3. Check Apify account status
4. Verify database connection

**Common Fixes:**

```bash
# Reset database connection
npm run dev

# Clear cache
rm -rf .next

# Reinstall dependencies
npm install
```

---

**Last Updated:** 2025-10-15

**Version:** 1.0

**Status:** ✅ Production Ready
