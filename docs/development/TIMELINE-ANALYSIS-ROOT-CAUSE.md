# Timeline Analysis - Root Cause Investigation
## €25 Credit Waste - 5 Simultaneous API Calls

**Generated:** 2025-10-11
**Total Cost:** $26.69 (€25)
**Issue:** Platform triggered 5 Apify runs simultaneously instead of 1

---

## Chronological Timeline

```
12:27:10 ─┬─ Run 1 START (tandarts Amsterdam)
          │  ├─ Duration: 10m 56s
          │  ├─ Results: 1,064 businesses
          │  └─ Cost: $4.26
          │
12:29:12 ─┼─ Run 2 START (tandarts Amsterdam)
          │  ├─ Duration: 8m 54s
          │  ├─ Results: 2,045 businesses
          │  └─ Cost: $8.19
          │
12:31:13 ─┼─ Run 3 START (best tandarts Amsterdam)
          │  ├─ Duration: 6m 52s
          │  ├─ Results: 218 businesses
          │  └─ Cost: $0.88
          │
12:33:17 ─┼─ Run 4 START (top tandarts Amsterdam)
          │  ├─ Duration: 4m 48s
          │  ├─ Results: 218 businesses
          │  └─ Cost: $0.88
          │
12:35:04 ─┴─ Run 5 START (physical_therapist Netherlands) ✅ CORRECT
             ├─ Duration: 2m 32s
             ├─ Results: 3,117 businesses
             └─ Cost: $12.48

12:37:36 ──── Run 5 COMPLETED (only this one finished successfully)
12:38:06 ──── Runs 1-4 ABORTED (billing limit reached)
12:38:07 ──── Run 2 ABORTED (billing limit reached)
```

---

## Critical Observations

### 1. All Triggered via API (Not Manual)
**Evidence:** All runs show "API" as origin
**Meaning:** Your platform's backend triggered these, not you clicking manually

### 2. 5 Runs in 8 Minutes
**Timeline:** 12:27:10 to 12:35:04 = 7 minutes 54 seconds
**Frequency:** New run every ~2 minutes
**Pattern:** Systematic, not random

### 3. 4 Wrong Parameters, 1 Correct
**Runs 1-4:** "tandarts Amsterdam" (WRONG - dentist, not physical therapist)
**Run 5:** "physical_therapist Netherlands" (CORRECT)

### 4. All Ran in Parallel
**Proof:** All 5 runs finished between 12:37-12:38 (within 1 minute)
**Impact:** Consumed credits simultaneously, hitting billing limit

### 5. Only Run 5 Completed
**Run 1-4:** Aborted due to billing limit
**Run 5:** Completed successfully (started last, finished first - shortest duration)

---

## Root Cause Hypothesis

### Most Likely Cause: API Loop/Retry Bug

**Scenario:**
1. You submitted ONE search request: "physical_therapist Netherlands"
2. Platform's backend received the request
3. **BUG:** Platform triggered multiple API calls due to:
   - Retry logic gone wrong
   - Loop iteration bug
   - Cached old parameters being reused
   - Race condition causing duplicate calls

**Evidence Supporting This:**
- First 4 calls used CACHED parameters ("tandarts Amsterdam")
- Last call used your ACTUAL parameters ("physical_therapist Netherlands")
- All triggered via API within 8 minutes
- Systematic timing (every ~2 minutes)

---

## Alternative Theories

### Theory 2: Frontend Multiple Submissions
**Scenario:** Frontend sent 5 requests to backend
**Likelihood:** LOW
**Why:** You would have noticed clicking 5 times or seeing 5 loading indicators

### Theory 3: Backend Batch Job Malfunction
**Scenario:** Old/pending jobs triggered alongside your new request
**Likelihood:** MEDIUM
**Why:** Explains cached parameters being reused

### Theory 4: Test Environment Leak
**Scenario:** Test searches accidentally triggered in production
**Likelihood:** MEDIUM
**Why:** "best" and "top" searches seem like test variations

---

## Platform Investigation Checklist

### 1. Backend API Logs ⚠️ CRITICAL
**Check:**
- How many API calls were sent to Apify?
- What parameters were in each call?
- What triggered each call?
- Were there retry attempts?

**Look for:**
```json
POST /api/start-extraction
{
  "category": "tandarts",  // Why tandarts?
  "location": "Amsterdam"  // Why Amsterdam?
}
```

### 2. Frontend Request Analysis
**Check:**
- Did frontend send 1 request or 5?
- Check browser DevTools Network tab for API calls
- Were there any failed requests that triggered retries?

### 3. Parameter Caching Investigation
**Check:**
- Does your platform cache search parameters?
- Is there a "recent searches" or "saved searches" feature?
- Could old parameters have been reused?

### 4. Apify Integration Code Review
**Check:**
```javascript
// WRONG: Loop triggering multiple calls
for (const searchVariation of variations) {
  await apify.startActor(searchVariation);
}

// RIGHT: Single call with user parameters
await apify.startActor(userSearchParams);
```

### 5. Environment Variable Check
**Check:**
- Are search parameters coming from environment variables?
- Could environment variables be set to "tandarts Amsterdam"?
- Did you switch environments (dev → prod)?

---

## Detailed Cost Breakdown

| Run | Dataset ID | Search Query | Results | Duration | Cost | Status |
|-----|-----------|--------------|---------|----------|------|--------|
| 1   | 1rKRlQhGgE8NKgSVq | tandarts Amsterdam | 1,064 | 10m 56s | $4.26 | Aborted |
| 2   | ksaR3CU2gMh5W2IKf | tandarts Amsterdam | 2,045 | 8m 54s | $8.19 | Aborted |
| 3   | wA7Ky5JbOeJhLN5m9 | best tandarts Amsterdam | 218 | 6m 52s | $0.88 | Aborted |
| 4   | SCkpkxNUkbBdfCn1f | top tandarts Amsterdam | 218 | 4m 48s | $0.88 | Aborted |
| 5   | kWSANBufm0setTQmD | physical_therapist Netherlands | 3,117 | 2m 32s | $12.48 | ✅ Complete |
| **TOTAL** | | | **6,662** | | **$26.69** | |

**Wasted Credits:** $14.21 (runs 1-4)
**Useful Data:** $12.48 (run 5 - physical therapist)

---

## Data Recovery Summary

### ✅ Successfully Backed Up

**Physical Therapist (USEFUL):**
- Dataset: kWSANBufm0setTQmD
- Businesses: 3,117
- File: `apify-backup-kWSANBufm0setTQmD-20251011.json` (7.4 MB)
- CSV: `backup-business-placeids-kWSANBufm0setTQmD.csv` (201 KB)

**Dentists Amsterdam (EXTRA):**
1. **Run 1:** 1,064 businesses - `backup-dentist-amsterdam-run1-1rKRlQhGgE8NKgSVq.csv` (202 KB)
2. **Run 2:** 2,045 businesses - `backup-dentist-amsterdam-run2-ksaR3CU2gMh5W2IKf.csv` (386 KB)
3. **Run 3:** 218 businesses - `backup-best-dentist-amsterdam-wA7Ky5JbOeJhLN5m9.csv` (43 KB)
4. **Run 4:** 218 businesses - `backup-top-dentist-amsterdam-SCkpkxNUkbBdfCn1f.csv` (44 KB)

**Total Businesses Recovered:** 6,662 (3,117 physical therapists + ~3,545 dentists)

---

## Recommended Actions

### Immediate (Today)
1. ✅ **Data Backed Up** - All 5 datasets saved
2. ⚠️ **Check Backend Logs** - Find what triggered the 5 API calls
3. ⚠️ **Review Apify Integration Code** - Look for loops or retry logic

### Short Term (This Week)
1. 🔧 **Fix Parameter Caching** - Ensure fresh parameters are used
2. 🔧 **Add Request Deduplication** - Prevent multiple simultaneous calls
3. 🧪 **Add Test Mode** - Limit businesses to 5 for testing
4. 📊 **Add Logging** - Track every API call with parameters

### Long Term (This Month)
1. 🎯 **Add Confirmation Modal** - Show parameters before triggering expensive searches
2. 💰 **Add Cost Estimator** - Show estimated cost before search
3. 🚨 **Add Billing Alerts** - Warn when approaching credit limit
4. 🧪 **Staging Environment** - Test searches without production credits

---

## Questions to Answer

1. **What triggered the first 4 API calls?** (12:27-12:33)
2. **Why were they using "tandarts Amsterdam" parameters?**
3. **Was this a retry/loop bug or cached parameters?**
4. **Why did searches vary?** (tandarts, best tandarts, top tandarts)
5. **Can you find the API logs showing the 5 calls?**

---

## Prevention Strategy

### Code Change Needed
```javascript
// BEFORE (VULNERABLE)
async function startExtraction(params) {
  // No deduplication
  await apify.startActor(params);
}

// AFTER (PROTECTED)
async function startExtraction(params) {
  // Check for active runs
  const activeRuns = await getActiveApifyRuns();
  if (activeRuns.length > 0) {
    throw new Error('Another search is already running');
  }

  // Log the request
  logger.info('Starting Apify search', {
    category: params.category,
    location: params.location,
    timestamp: new Date()
  });

  // Store in database for audit
  await db.saveSearchRequest(params);

  // Execute
  const run = await apify.startActor(params);

  return run;
}
```

---

**Report End**

**Next Step:** Check your backend API logs for the time period 12:27:10 - 12:35:04 to see exactly what API calls were made.
