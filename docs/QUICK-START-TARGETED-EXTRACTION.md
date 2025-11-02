# 🚀 QUICK START: Targeted Review Extraction

## ✅ What Was Created

Three new tools for extracting reviews from your cached businesses:

1. **`preview-cached-businesses.js`** - See what's in your cache
2. **`extract-from-cache-simple.js`** - Extract reviews (simple API call)
3. **`extract-reviews-from-cache.js`** - Extract reviews (advanced, direct)

## 💰 The Concept

**You already have 5,216 businesses cached in your database.**

Instead of paying to find businesses again, just extract their reviews!

**Cost Savings:**
- Full extraction: $0.05 (find) + $0.02 × N (reviews) = $0.05 + ($0.02 × N)
- Targeted extraction: $0.00 (cache!) + $0.02 × N (reviews) = $0.02 × N
- **Savings: $0.05 per extraction + 100% on business search**

## 🎯 Your Cached Data

```
Amsterdam Dentists: 619 businesses ⭐
Rating ≤4.6: ~200+ businesses
Total cache value: $156.48
```

## 📋 Step-by-Step Usage

### Step 1: Check What's Available

```bash
cd /Users/kris/CLAUDEtools/QuartzIQ
node preview-cached-businesses.js tandarts Amsterdam 4.6 10
```

**You'll see:**
- 10 Amsterdam dentists with rating ≤4.6
- Their addresses, place IDs, ratings
- Cost estimate for extraction

### Step 2: Start Dev Server

```bash
npm run dev
```

(Keep this running in a separate terminal)

### Step 3: Extract Reviews

```bash
# Start small (5 businesses)
node extract-from-cache-simple.js tandarts Amsterdam 5

# Scale up (20 businesses)
node extract-from-cache-simple.js tandarts Amsterdam 20
```

**You'll get:**
- Reviews extracted from each business
- Cost breakdown
- Cache performance metrics
- All reviews saved to database

## 🔍 What Happens

```
1. Query database for Amsterdam dentists with rating ≤4.6
   └─ Cost: $0.00 (cache!)

2. Extract reviews from their place_ids using Apify
   └─ Cost: $0.02 per business

3. Cache reviews in database
   └─ Future extractions FREE

4. Display results
   └─ Businesses processed, reviews found, cost saved
```

## 💡 Example Output

```
🚀 TARGETED REVIEW EXTRACTION FROM CACHE

✅ SUCCESS!

📋 Summary:
   Businesses found: 10
   Reviews extracted: 47
   Negative reviews (≤3★): 32
   Duration: 2.3 min

💰 Cost Breakdown:
   Business search: $0.00 (cached! 🎉)
   Review extraction: $0.20
   Total cost: $0.20
   💵 Savings: $0.05 (20%)

📋 Businesses Processed:

   1. Aqua Dental Clinic
      Rating: ⭐ 1.0★
      Reviews extracted: 1 (1 negative)

   2. Tandartsenpraktijk Marquenie
      Rating: ⭐ 1.0★
      Reviews extracted: 1 (1 negative)

   3. Tandartsenpraktijk Sumatra
      Rating: ⭐ 2.1★
      Reviews extracted: 8 (6 negative)

   ... (7 more)
```

## 🎯 Common Use Cases

### 1. Monitor Competitors (Daily)

```bash
node extract-from-cache-simple.js tandarts Amsterdam 50
```

Cost: ~$1.00/day
Result: Track 50 competitor reviews daily

### 2. Lead Generation (Weekly)

```bash
# Extract very negative reviews (1-2 stars)
# Edit: maxReviewStars: 2 in script
node extract-from-cache-simple.js tandarts Amsterdam 100
```

Cost: ~$2.00/week
Result: 20-30 businesses with recent issues

### 3. Reputation Analysis (Monthly)

```bash
# Extract last 30 days, all negative (≤3★)
node extract-from-cache-simple.js tandarts Amsterdam 200
```

Cost: ~$4.00/month
Result: Comprehensive negative review analysis

## ⚙️ Configuration Options

Edit `extract-from-cache-simple.js`:

```javascript
const CONFIG = {
  category: 'tandarts',           // Change category
  location: 'Amsterdam',          // Change city
  businessLimit: 5,               // How many businesses
  maxReviewStars: 3,              // ≤3 stars (negative)
  dayLimit: 30,                   // Last 30 days
  maxReviewsPerBusiness: 10,      // Reviews per business
};
```

**Common Adjustments:**

```javascript
// Only VERY negative (1-2 stars)
maxReviewStars: 2

// Last 60 days
dayLimit: 60

// More reviews per business
maxReviewsPerBusiness: 20
```

## 📊 Expected Performance

| Businesses | Time | Cost |
|------------|------|------|
| 5 | 30-60s | $0.10 |
| 10 | 1-2 min | $0.20 |
| 20 | 2-3 min | $0.40 |
| 50 | 5-8 min | $1.00 |
| 100 | 10-15 min | $2.00 |

## ⚠️ Important Notes

### ✅ DO:
- Start with 5-10 businesses for testing
- Check cache first with preview script
- Monitor Apify credit usage
- Keep dev server running during extraction

### ❌ DON'T:
- Extract > 100 businesses at once (rate limits)
- Run multiple extractions simultaneously
- Extract without checking preview first
- Forget to start dev server

## 🆘 Troubleshooting

### "Connection Refused"
```bash
# Make sure dev server is running
npm run dev
```

### "No businesses found"
```bash
# Check what's actually cached
node preview-cached-businesses.js tandarts Amsterdam 5.0 100
```

### "Timeout"
```bash
# Reduce businessLimit
node extract-from-cache-simple.js tandarts Amsterdam 10
```

### "Apify 403 Error"
- Check Apify credits: https://console.apify.com/billing
- System will fallback to cached reviews

## 📚 Full Documentation

Read `TARGETED-REVIEW-EXTRACTION-GUIDE.md` for:
- Advanced configuration
- Batch processing
- Cost optimization strategies
- Automation with cron
- Export and analysis

## 🎉 Ready to Go!

You now have a cost-effective way to extract reviews from your cached businesses.

**Start small, test it, then scale up!**

```bash
# Your first extraction
node preview-cached-businesses.js tandarts Amsterdam 4.6 5
npm run dev  # (separate terminal)
node extract-from-cache-simple.js tandarts Amsterdam 5
```

---

**Questions? Check:** `TARGETED-REVIEW-EXTRACTION-GUIDE.md`

**Status:** ✅ Ready to use with Apify credits
