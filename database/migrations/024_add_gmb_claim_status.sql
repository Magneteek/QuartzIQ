-- ============================================================
-- Migration 024: GMB Claim Status
-- Purpose: Track whether a business's Google Business Profile is
-- claimed, for the "roast" qualifier pipeline (no-website / unclaimed
-- / stale-website prospecting). Sourced from DataForSEO business_data_search
-- is_claimed field, which comes back free in the existing discovery call.
-- ============================================================

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN; -- null = not yet checked

CREATE INDEX IF NOT EXISTS idx_businesses_is_claimed ON businesses(is_claimed);
