-- Migration 009: Add Contact and Review Fields
-- Purpose: Add fields for contact information, review tracking, and import status

-- 1. Add contact and business fields to businesses table
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS category VARCHAR(255),
ADD COLUMN IF NOT EXISTS google_profile_url TEXT,
ADD COLUMN IF NOT EXISTS negative_review_url TEXT,
ADD COLUMN IF NOT EXISTS import_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
ADD COLUMN IF NOT EXISTS import_notes TEXT;

-- 2. Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_businesses_email ON businesses(email);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_import_status ON businesses(import_status);
CREATE INDEX IF NOT EXISTS idx_businesses_first_name ON businesses(first_name);
CREATE INDEX IF NOT EXISTS idx_businesses_last_name ON businesses(last_name);

-- 3. Drop existing function (required when changing return type)
DROP FUNCTION IF EXISTS get_leads_for_va(INTEGER, INTEGER, TEXT, VARCHAR, VARCHAR);

-- 4. Create updated get_leads_for_va function with new fields
CREATE OR REPLACE FUNCTION get_leads_for_va(
  p_limit INTEGER DEFAULT 15,
  p_offset INTEGER DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_sort_by VARCHAR DEFAULT 'created_at',
  p_sort_order VARCHAR DEFAULT 'DESC'
) RETURNS TABLE (
  id UUID,
  business_name VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  website VARCHAR,
  category VARCHAR,
  place_id VARCHAR,
  address TEXT,
  city VARCHAR,
  country VARCHAR,
  rating DECIMAL,
  total_reviews INTEGER,
  lifecycle_stage VARCHAR,
  data_source VARCHAR,
  qualification_date TIMESTAMP,
  qualified_by_name VARCHAR,
  ready_for_enrichment BOOLEAN,
  import_status VARCHAR,
  google_profile_url TEXT,
  negative_review_url TEXT,
  review_count BIGINT,
  latest_review_date TIMESTAMP,
  oldest_review_date TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.business_name,
    b.first_name,
    b.last_name,
    b.email,
    b.phone,
    b.website,
    b.category,
    b.place_id,
    b.address,
    b.city,
    b.country,
    b.rating,
    b.total_reviews,
    b.lifecycle_stage,
    b.data_source,
    b.qualification_date,
    u.name AS qualified_by_name,
    b.ready_for_enrichment,
    b.import_status,
    b.google_profile_url,
    b.negative_review_url,
    COUNT(r.id) AS review_count,
    MAX(r.review_date) AS latest_review_date,
    MIN(r.review_date) AS oldest_review_date,
    b.created_at,
    b.updated_at
  FROM businesses b
  LEFT JOIN users u ON b.qualified_by = u.id
  LEFT JOIN reviews r ON b.id = r.business_id
  WHERE b.lifecycle_stage = 'lead'
    AND (p_search IS NULL OR
         b.business_name ILIKE '%' || p_search || '%' OR
         b.email ILIKE '%' || p_search || '%' OR
         b.first_name ILIKE '%' || p_search || '%' OR
         b.last_name ILIKE '%' || p_search || '%')
  GROUP BY b.id, u.name
  ORDER BY
    CASE WHEN p_sort_by = 'business_name' AND p_sort_order = 'ASC' THEN b.business_name END ASC,
    CASE WHEN p_sort_by = 'business_name' AND p_sort_order = 'DESC' THEN b.business_name END DESC,
    CASE WHEN p_sort_by = 'created_at' AND p_sort_order = 'ASC' THEN b.created_at END ASC,
    CASE WHEN p_sort_by = 'created_at' AND p_sort_order = 'DESC' THEN b.created_at END DESC,
    CASE WHEN p_sort_by = 'rating' AND p_sort_order = 'ASC' THEN b.rating END ASC,
    CASE WHEN p_sort_by = 'rating' AND p_sort_order = 'DESC' THEN b.rating END DESC,
    CASE WHEN p_sort_by = 'email' AND p_sort_order = 'ASC' THEN b.email END ASC,
    CASE WHEN p_sort_by = 'email' AND p_sort_order = 'DESC' THEN b.email END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Migration complete
-- Next steps:
-- 1. Apply migration: npx ts-node scripts/run-migration-009.ts
-- 2. Update UI to display new fields
-- 3. Update forms to capture new fields
