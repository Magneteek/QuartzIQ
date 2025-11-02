-- Fix: Businesses table trigger uses wrong column name
-- The table has 'last_updated_at' but the trigger tries to set 'updated_at'

-- Drop the existing incorrect trigger
DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;

-- Create a new function specifically for businesses table
CREATE OR REPLACE FUNCTION update_businesses_last_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the corrected trigger
CREATE TRIGGER update_businesses_last_updated_at BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_businesses_last_updated_at();

-- Verify the fix
SELECT
    'Trigger fixed successfully' as status,
    tgname as trigger_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'businesses'::regclass;
