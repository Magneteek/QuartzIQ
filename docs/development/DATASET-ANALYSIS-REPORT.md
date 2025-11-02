# Dataset Analysis Report - Search Parameter Mismatch

**Generated:** 2025-10-11
**Critical Issue:** Platform sent WRONG search parameters to Apify

---

## Your Configured Criteria

```
Category: physical_therapist
Target Location: Netherlands
Business Rating: ≥ 2.7
Max Review Stars: ≤ 3
Time Window: 14 days
Business Limit: No limit
```

---

## What Was ACTUALLY Searched (Apify Data Analysis)

### Dataset 1: 1rKRlQhGgE8NKgSVq
- **Count:** 1,064 businesses
- **Search Query:** "tandarts Amsterdam" (Dentist Amsterdam)
- **Location:** Amsterdam ONLY (not all Netherlands)
- **Category:** Tandartspraktijk / Tandarts (Dental practice)
- **Rating Range:** 4.3 - 5.0 (HIGH-rated businesses, not 2.7-3.0)
- **Scraped:** 2025-10-11T11:27:16.757Z

**Sample Businesses:**
- The Dentist Amsterdam (4.9 stars, 58 reviews)
- De Amsterdamse Tandarts (4.7 stars, 154 reviews)
- Etiq tandartsen Amsterdam (5.0 stars, 38 reviews)

---

### Dataset 2: ksaR3CU2gMh5W2IKf
- **Count:** 2,045 businesses (LARGEST)
- **Search Query:** "tandarts Amsterdam" (same as Dataset 1)
- **Location:** Amsterdam ONLY
- **Category:** Tandartspraktijk / Tandarts
- **Rating Range:** 4.3 - 5.0
- **Scraped:** 2025-10-11T11:29:19.155Z
- **Note:** This appears to be a continuation/retry of Dataset 1

---

### Dataset 3: wA7Ky5JbOeJhLN5m9
- **Count:** 218 businesses
- **Search Query:** "best tandarts Amsterdam" (Best Dentist Amsterdam)
- **Location:** Amsterdam ONLY
- **Category:** Tandartspraktijk
- **Rating Range:** 4.3+ (TOP-rated businesses)
- **Scraped:** 2025-10-11T11:31:20.993Z

**Sample Business:**
- Besth (4.3 stars, 122 reviews)
  - 17 one-star reviews
  - 2 two-star reviews
  - 3 three-star reviews

---

### Dataset 4: SCkpkxNUkbBdfCn1f
- **Count:** 218 businesses
- **Search Query:** "top tandarts Amsterdam" (Top Dentist Amsterdam)
- **Location:** Amsterdam ONLY
- **Category:** Tandartspraktijk
- **Rating Range:** 4.3+ (TOP-rated businesses)
- **Scraped:** 2025-10-11T11:33:24.468Z
- **Note:** Appears to be duplicate of Dataset 3 with different search terms

---

## Critical Issues Identified

### 1. Wrong Category ❌
- **Expected:** physical_therapist (Fysiotherapeut)
- **Got:** tandarts / tandartspraktijk (Dentist)

### 2. Wrong Location Scope ❌
- **Expected:** Netherlands (nationwide)
- **Got:** Amsterdam (single city)

### 3. Wrong Rating Filter ❌
- **Expected:** ≥ 2.7 (to find businesses with mixed/lower ratings)
- **Got:** High-rated businesses 4.3 - 5.0 stars

### 4. Search Variations Without Need ❓
- Why 4 different searches for the same thing?
  - "tandarts Amsterdam"
  - "tandarts Amsterdam" (again)
  - "best tandarts Amsterdam"
  - "top tandarts Amsterdam"

---

## Data Recovery Summary

**Total Businesses Collected:** ~3,545 dentists in Amsterdam
- Dataset 1: 1,064 businesses
- Dataset 2: 2,045 businesses
- Dataset 3: 218 businesses
- Dataset 4: 218 businesses

**Note:** Significant overlap likely exists between datasets

---

## Impact Analysis

### Credit Usage 💰
- **Credits Spent:** Expensive (4 map searches + 3,545 businesses)
- **Value Alignment:** ❌ Data doesn't match your business needs
- **Physical Therapists Found:** 0 (wrong category searched)

### Business Use Case Fit
If you're targeting **physical therapists** with **negative reviews** in the **Netherlands**:
- This data is **NOT useful** (wrong specialty, wrong location scope)
- **Recommendation:** Don't extract reviews from these datasets

If you're interested in **Amsterdam dentists** for a different project:
- This data is **valuable** (3,545 dentists)
- **Recommendation:** Back up for future use

---

## Root Cause Investigation Needed

**Questions for Platform Review:**
1. How did "physical_therapist" become "tandarts"?
2. How did "Netherlands" become "Amsterdam"?
3. Why did the rating filter reverse (≥2.7 vs getting 4.3+)?
4. Why were 4 separate searches triggered?

**Possible Causes:**
- Frontend/backend parameter mapping bug
- API integration error between your platform and Apify
- Cached/previous search parameters reused
- Multiple search jobs triggered accidentally

---

## Recommendation

**DO NOT extract reviews from these datasets** unless you have a separate use case for Amsterdam dentists.

**Next Steps:**
1. ✅ Backup the Place IDs anyway (you paid for them)
2. ⚠️ Investigate platform bug that caused wrong parameters
3. 🔄 Re-run search with CORRECT parameters when bug is fixed
4. 💡 Consider running a test search with 5 business limit before large runs

---

**Report End**
