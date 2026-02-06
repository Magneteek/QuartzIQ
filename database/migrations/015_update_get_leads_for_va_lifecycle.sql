/**
 * Migration 015: Update get_leads_for_va to show both prospects and leads
 *
 * Changes:
 * - Remove hardcoded lifecycle_stage = 'lead' filter
 * - Show both 'prospect' and 'lead' stages
 * - Add lifecycle_stage parameter (optional)
 *
 * This allows VA to see all imported businesses (5,795 prospects)
 * instead of only the 6 businesses in 'lead' stage.
 */

-- Drop existing function
DROP FUNCTION IF EXISTS get_leads_for_va(INTEGER, INTEGER, TEXT, VARCHAR, VARCHAR);

-- Recreate function with lifecycle_stage parameter
CREATE OR REPLACE FUNCTION get_leads_for_va(
  p_limit INTEGER DEFAULT 15,
  p_offset INTEGER DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_sort_by VARCHAR DEFAULT 'first_discovered_at',
  p_sort_order VARCHAR DEFAULT 'DESC',
  p_lifecycle_stage TEXT DEFAULT NULL  -- NEW: Optional filter
) RETURNS TABLE (
  id UUID,
  business_name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  category TEXT,
  place_id TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  rating DECIMAL(2, 1),
  total_reviews INTEGER,
  lifecycle_stage TEXT,
  data_source TEXT,
  qualification_date TIMESTAMP,
  qualified_by_name TEXT,
  ready_for_enrichment BOOLEAN,
  import_status TEXT,
  google_profile_url TEXT,
  negative_review_url TEXT,
  va_notes TEXT,
  review_count BIGINT,
  latest_review_date DATE,
  oldest_review_date DATE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    CAST(b.name AS TEXT) AS business_name,
    CAST(b.first_name AS TEXT) AS first_name,
    CAST(b.last_name AS TEXT) AS last_name,
    CAST(b.email AS TEXT) AS email,
    CAST(b.phone AS TEXT) AS phone,
    CAST(b.website AS TEXT) AS website,
    CAST(b.category AS TEXT) AS category,
    CAST(b.place_id AS TEXT) AS place_id,
    CAST(b.address AS TEXT) AS address,
    CAST(b.city AS TEXT) AS city,
    CAST(b.country_code AS TEXT) AS country,
    b.rating,
    b.reviews_count AS total_reviews,
    CAST(b.lifecycle_stage AS TEXT) AS lifecycle_stage,
    CAST(b.data_source AS TEXT) AS data_source,
    b.qualification_date,
    CAST(u.name AS TEXT) AS qualified_by_name,
    b.ready_for_enrichment,
    CAST(b.import_status AS TEXT) AS import_status,
    CAST(b.google_profile_url AS TEXT) AS google_profile_url,
    CAST(b.negative_review_url AS TEXT) AS negative_review_url,
    b.va_notes,
    COUNT(r.id) AS review_count,
    MAX(r.published_date) AS latest_review_date,
    MIN(r.published_date) AS oldest_review_date,
    b.first_discovered_at AS created_at,
    b.last_updated_at AS updated_at
  FROM businesses b
  LEFT JOIN users u ON b.qualified_by = u.id
  LEFT JOIN reviews r ON b.id = r.business_id
  WHERE
    -- Show both prospects and leads (or filter by specific stage)
    (p_lifecycle_stage IS NULL OR b.lifecycle_stage = p_lifecycle_stage)
    -- Default: show prospects and leads only
    AND (p_lifecycle_stage IS NOT NULL OR b.lifecycle_stage IN ('prospect', 'lead'))
    -- Search filter
    AND (p_search IS NULL OR
         b.name ILIKE '%' || p_search || '%' OR
         b.email ILIKE '%' || p_search || '%' OR
         b.first_name ILIKE '%' || p_search || '%' OR
         b.last_name ILIKE '%' || p_search || '%')
  GROUP BY b.id, u.name
  ORDER BY
    CASE WHEN p_sort_by = 'business_name' AND p_sort_order = 'ASC' THEN b.name END ASC,
    CASE WHEN p_sort_by = 'business_name' AND p_sort_order = 'DESC' THEN b.name END DESC,
    CASE WHEN p_sort_by = 'created_at' AND p_sort_order = 'ASC' THEN b.first_discovered_at END ASC,
    CASE WHEN p_sort_by = 'created_at' AND p_sort_order = 'DESC' THEN b.first_discovered_at END DESC,
    CASE WHEN p_sort_by = 'rating' AND p_sort_order = 'ASC' THEN b.rating END ASC,
    CASE WHEN p_sort_by = 'rating' AND p_sort_order = 'DESC' THEN b.rating END DESC,
    CASE WHEN p_sort_by = 'total_reviews' AND p_sort_order = 'ASC' THEN b.reviews_count END ASC,
    CASE WHEN p_sort_by = 'total_reviews' AND p_sort_order = 'DESC' THEN b.reviews_count END DESC,
    CASE WHEN p_sort_by = 'first_discovered_at' AND p_sort_order = 'ASC' THEN b.first_discovered_at END ASC,
    CASE WHEN p_sort_by = 'first_discovered_at' AND p_sort_order = 'DESC' THEN b.first_discovered_at END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Update get_lead_stats to count both prospects and leads
DROP FUNCTION IF EXISTS get_lead_stats();

CREATE OR REPLACE FUNCTION get_lead_stats()
RETURNS TABLE (
  total_leads BIGINT,
  ready_for_enrichment BIGINT,
  added_today BIGINT,
  added_this_week BIGINT,
  average_rating DECIMAL(3, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_leads,
    COUNT(CASE WHEN b.ready_for_enrichment = true THEN 1 END)::BIGINT AS ready_for_enrichment,
    COUNT(CASE WHEN DATE(b.first_discovered_at) = CURRENT_DATE THEN 1 END)::BIGINT AS added_today,
    COUNT(CASE WHEN b.first_discovered_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END)::BIGINT AS added_this_week,
    ROUND(AVG(b.rating), 2) AS average_rating
  FROM businesses b
  WHERE b.lifecycle_stage IN ('prospect', 'lead');  -- Count both stages
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION get_leads_for_va IS 'Fetches businesses for VA lead qualification. Shows prospects and leads by default. Use p_lifecycle_stage to filter by specific stage.';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 015 complete: Updated get_leads_for_va to show prospects and leads';
END$$;
