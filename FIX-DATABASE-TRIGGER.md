# Database Trigger Fix - Manual Instructions

## Problem Identified

**Error**: `record "new" has no field "updated_at"`

**Root Cause**: The `update_businesses_updated_at` trigger function tries to set `NEW.updated_at`, but the `businesses` table has a column named `last_updated_at`, not `updated_at`.

## The Fix

Run these SQL commands in your Supabase SQL Editor:

### Step 1: Drop the Incorrect Trigger
```sql
DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
```

### Step 2: Create the Correct Function
```sql
CREATE OR REPLACE FUNCTION update_businesses_last_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Step 3: Create the Corrected Trigger
```sql
CREATE TRIGGER update_businesses_last_updated_at
BEFORE UPDATE ON businesses
FOR EACH ROW
EXECUTE FUNCTION update_businesses_last_updated_at();
```

### Step 4: Verify the Fix
```sql
SELECT
    tgname as trigger_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'businesses'::regclass;
```

Expected output:
```
trigger_name                        | function_name
------------------------------------|----------------------------------
update_businesses_last_updated_at   | update_businesses_last_updated_at
generate_business_fingerprint       | auto_generate_fingerprint
```

## How to Apply

### Option 1: Supabase Dashboard (Easiest)
1. Go to https://supabase.com
2. Open your QuartzIQ project
3. Click "SQL Editor" in the left sidebar
4. Copy and paste ALL the SQL commands above
5. Click "Run" or press Cmd+Enter

### Option 2: Using psql (If Available)
```bash
# Install psql first:
brew install postgresql

# Then run:
psql "postgresql://YOUR_USER:YOUR_PASSWORD@YOUR_HOST:YOUR_PORT/postgres?sslmode=require" \
  -f database/migrations/fix-businesses-trigger.sql
```

## After Applying the Fix

1. **Restart QuartzIQ Server**: Stop and restart `npm run dev`
2. **Run a Test Extraction**: Try the insurance_agency search again
3. **Verify Success**: Check that businesses are being cached:
   ```
   ✨ Cached new business: Pogona Insurance
   ✨ Cached new business: London General Insurance Company
   ...
   ```

## What This Fixes

### Before (Broken):
- Extraction finds 190 businesses ❌
- Trigger throws error: `record "new" has no field "updated_at"` ❌
- Caching fails ❌
- Result: 0 businesses cached, 0 reviews extracted ❌

### After (Fixed):
- Extraction finds 190 businesses ✅
- Trigger updates `last_updated_at` correctly ✅
- Caching succeeds ✅
- Result: 190 businesses cached, reviews extracted ✅

## Your Last Extraction Summary

Based on the server logs:

### What Was Found:
- ✅ **200 businesses** retrieved from Apify
- ✅ **190 businesses** passed smart crawl filter
- ✅ **154 businesses** had reviews (81% quality rate)
- ✅ Geographic filtering working correctly

### What Failed:
- ❌ **Database caching** - trigger error prevented storage
- ❌ **Review extraction** - can't extract reviews without cached businesses
- ❌ **Cost savings** - couldn't cache for future use

### After the Fix:
- ✅ All 190 businesses will be cached properly
- ✅ Reviews will be extracted from 154 businesses
- ✅ Future extractions will use cache (~$5.70 savings)
- ✅ Insurance agencies in Amsterdam will be available

## Need Help?

If you encounter any issues:
1. Check that all SQL commands ran successfully
2. Verify the trigger exists with the verify command
3. Check server logs for any new errors
4. Contact support if the problem persists
