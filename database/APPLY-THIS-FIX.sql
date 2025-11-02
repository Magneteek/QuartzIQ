-- ============================================================
-- DATABASE TRIGGER FIX FOR BUSINESSES TABLE
-- ============================================================
-- Problem: Trigger uses wrong column name (updated_at vs last_updated_at)
-- This causes: "record 'new' has no field 'updated_at'" error
-- Result: Businesses don't get cached, extractions fail
-- ============================================================

-- STEP 1: Remove the broken trigger
DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;

-- STEP 2: Create the correct trigger function
CREATE OR REPLACE FUNCTION update_businesses_last_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 3: Apply the corrected trigger
CREATE TRIGGER update_businesses_last_updated_at
BEFORE UPDATE ON businesses
FOR EACH ROW
EXECUTE FUNCTION update_businesses_last_updated_at();

-- STEP 4: Verify the fix (check the results below)
SELECT
    tgname as trigger_name,
    proname as function_name,
    'SUCCESS - Trigger is now using the correct column!' as status
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'businesses'::regclass
AND tgname = 'update_businesses_last_updated_at';

-- ============================================================
-- EXPECTED RESULT:
-- trigger_name: update_businesses_last_updated_at
-- function_name: update_businesses_last_updated_at
-- status: SUCCESS - Trigger is now using the correct column!
-- ============================================================
