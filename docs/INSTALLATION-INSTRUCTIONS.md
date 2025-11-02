# Installation Instructions: API Protection

## Quick Decision Guide

**Choose Option 1 (Global Lock) if:**
- ✅ You want **maximum cost protection**
- ✅ You're okay with only 1 extraction at a time
- ✅ You want the **simplest implementation**
- ✅ This is for single-user use

**Choose Option 2 (Per-Fingerprint) if:**
- ✅ You need **multiple different searches** to run simultaneously
- ✅ You have multiple users
- ✅ You want "dentist Amsterdam" + "physical therapist Rotterdam" to run at the same time

---

## Option 1: Global Lock (RECOMMENDED)

### Installation (2 Minutes)

**Step 1:** Backup your current file
```bash
cp src/app/api/extract/route.ts src/app/api/extract/route.ts.backup
```

**Step 2:** Replace the file
```bash
cp src/app/api/extract/route-OPTION1-global-lock.ts src/app/api/extract/route.ts
```

**Step 3:** Restart your development server
```bash
# Press Ctrl+C to stop
# Then restart:
npm run dev
```

### Done! ✅

---

## Option 2: Per-Fingerprint Lock

### Installation (2 Minutes)

**Step 1:** Backup your current file
```bash
cp src/app/api/extract/route.ts src/app/api/extract/route.ts.backup
```

**Step 2:** Replace the file
```bash
cp src/app/api/extract/route-OPTION2-per-fingerprint.ts src/app/api/extract/route.ts
```

**Step 3:** Restart your development server
```bash
# Press Ctrl+C to stop
# Then restart:
npm run dev
```

### Done! ✅

---

## Testing Your Installation

### Test 1: Verify Protection Works

**Option 1 (Global Lock) Test:**
1. Open your dashboard
2. Start an extraction: "dentist" + "Amsterdam"
3. **While it's running**, try to start another: "physical_therapist" + "Rotterdam"
4. ✅ **Expected:** Second request is blocked with error message
5. ✅ **Success:** You see "Another extraction is in progress"

**Option 2 (Per-Fingerprint) Test:**
1. Start extraction: "dentist" + "Amsterdam"
2. **While it's running**, try same search: "dentist" + "Amsterdam"
3. ✅ **Expected:** Duplicate is blocked
4. Try different search: "physical_therapist" + "Rotterdam"
5. ✅ **Expected:** Different search is allowed (runs in parallel)

### Test 2: Check Logs

```bash
# Watch server console output
# You should see clear logging:

🔵 EXTRACTION STARTED
══════════════════════════════════════════════════════
Request ID: req_1760123456_abc123
Category: dentist
Location: Amsterdam
Lock Status: ACQUIRED ✅
══════════════════════════════════════════════════════

# When duplicate is blocked:
⚠️ EXTRACTION BLOCKED: Another extraction is already running

# When complete:
✅ EXTRACTION COMPLETED SUCCESSFULLY
Lock Status: RELEASING... 🔓
🔓 LOCK RELEASED - System ready for next extraction
```

---

## Monitoring & Status Check

### Check if Extraction is Running

**Browser:**
```
GET http://localhost:3000/api/extract
```

**Option 1 Response:**
```json
{
  "isExtractionRunning": true,
  "currentExtraction": {
    "category": "dentist",
    "location": "Amsterdam",
    "startedAt": "2025-10-11T14:30:00.000Z"
  },
  "message": "Extraction in progress: dentist in Amsterdam"
}
```

**Option 2 Response:**
```json
{
  "activeExtractionCount": 2,
  "activeExtractions": [
    {
      "fingerprint": "dentist-amsterdam",
      "requestId": "req_1760123456_abc123",
      "startedAt": "2025-10-11T14:30:00.000Z",
      "durationSeconds": 45
    },
    {
      "fingerprint": "physical_therapist-rotterdam",
      "requestId": "req_1760123789_def456",
      "startedAt": "2025-10-11T14:30:30.000Z",
      "durationSeconds": 15
    }
  ],
  "message": "2 extraction(s) in progress"
}
```

---

## Rollback (If Needed)

If you need to revert to the original:

```bash
# Restore backup
cp src/app/api/extract/route.ts.backup src/app/api/extract/route.ts

# Restart server
npm run dev
```

---

## What Each Option Does

### Option 1: Global Lock

**How it works:**
```typescript
// Simple boolean flag
let isExtractionRunning = false

if (isExtractionRunning) {
  return error // Block everything
}

isExtractionRunning = true // Lock acquired
try {
  // Do extraction
} finally {
  isExtractionRunning = false // Lock released
}
```

**Behavior:**
- ✅ Only 1 extraction total at any time
- ✅ Simple and foolproof
- ✅ Maximum cost protection
- ⚠️ Users must wait for previous extraction to finish

---

### Option 2: Per-Fingerprint Lock

**How it works:**
```typescript
// Map tracking each unique search
const activeExtractions = new Map()
const fingerprint = `${category}-${location}`

if (activeExtractions.has(fingerprint)) {
  return error // Block duplicates only
}

activeExtractions.set(fingerprint, metadata) // Register
try {
  // Do extraction
} finally {
  activeExtractions.delete(fingerprint) // Clean up
}
```

**Behavior:**
- ✅ Multiple DIFFERENT searches can run in parallel
- ✅ Blocks identical searches
- ✅ Better for multi-user scenarios
- ⚠️ Slightly more complex

---

## Comparing Logs

### Option 1 Logs (Simpler):
```
🔵 EXTRACTION STARTED
Category: dentist
Location: Amsterdam
Lock Status: ACQUIRED ✅

⚠️ EXTRACTION BLOCKED: Another extraction is already running
Blocked request: physical_therapist in Rotterdam

✅ EXTRACTION COMPLETED SUCCESSFULLY
Lock Status: RELEASING... 🔓
```

### Option 2 Logs (More Detailed):
```
🔵 EXTRACTION STARTED
Fingerprint: dentist-amsterdam
Active Extractions: 1
Fingerprints: [dentist-amsterdam]

🔵 EXTRACTION STARTED (parallel)
Fingerprint: physical_therapist-rotterdam
Active Extractions: 2
Fingerprints: [dentist-amsterdam, physical_therapist-rotterdam]

⚠️ DUPLICATE EXTRACTION BLOCKED
Fingerprint: dentist-amsterdam
Existing Request ID: req_xxx

✅ EXTRACTION COMPLETED SUCCESSFULLY
Fingerprint: dentist-amsterdam
Active Extractions Remaining: 1
```

---

## Benefits of Both Options

### Both Options Include:

✅ **Comprehensive Logging**
- Every request is logged with timestamp
- Clear indication of what's running
- Easy debugging

✅ **Automatic Cleanup**
- Locks released even if error occurs
- No stuck locks

✅ **User-Friendly Errors**
- Clear error messages
- Suggests retry time
- Shows what's currently running

✅ **Status Endpoint**
- Check extraction status via GET /api/extract
- See what's running
- Monitor progress

✅ **Request IDs**
- Unique ID for every extraction
- Easy audit trail
- Track specific requests

---

## Cost Savings

**Before Fix:**
- 5 API calls when you wanted 1
- $26.69 wasted

**After Fix (Either Option):**
- ✅ Maximum 1 API call per unique request
- ✅ Duplicates blocked immediately
- ✅ Clear logging for audit
- ✅ No more surprise credit usage

---

## Troubleshooting

### "Lock is stuck - nothing can run"

**Option 1 Solution:**
Restart the development server - this resets the boolean flag

```bash
# Ctrl+C to stop
npm run dev
```

**Option 2 Solution:**
Same - restart clears the Map

---

### "I see multiple extractions running"

**Option 1:** This shouldn't happen - file a bug report
**Option 2:** This is normal if they're DIFFERENT searches

---

### "Error message says retry after 60 seconds"

This is correct behavior! Wait 60 seconds (Option 1) or 30 seconds (Option 2) and try again.

Or wait for the extraction to complete - you'll see in logs:
```
✅ EXTRACTION COMPLETED SUCCESSFULLY
🔓 LOCK RELEASED
```

---

## Production Deployment

When deploying to production:

1. ✅ Use the same file replacement
2. ✅ Restart your production server
3. ✅ Monitor logs for first 24 hours
4. ✅ Set up alerts for duplicate attempts

---

## Summary

**For your use case (€25 credit waste prevention):**
→ **Use Option 1 (Global Lock)**

**Why:**
- Simplest implementation
- Maximum cost protection
- Exactly what you need

**You can always upgrade to Option 2 later if you need parallel extractions!**

---

**Installation time: 2 minutes**
**Testing time: 5 minutes**
**Total time to protect yourself: 7 minutes**

🎉 **Ready to install?** Follow the steps above!
