-- Migration 010: Add va_notes to get_leads_for_va function
-- Purpose: Include VA notes in the lead listing query

-- Drop and recreate the function with va_notes field
DROP FUNCTION IF EXISTS get_leads_for_va(INTEGER, INTEGER, TEXT, VARCHAR, VARCHAR);

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
  va_notes TEXT,
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
    b.va_notes,
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
