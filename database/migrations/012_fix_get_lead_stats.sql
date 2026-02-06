-- Migration 012: Fix get_lead_stats function column references
-- Purpose: Fix ambiguous column references and use correct column names

DROP FUNCTION IF EXISTS get_lead_stats();

CREATE OR REPLACE FUNCTION get_lead_stats()
RETURNS TABLE (
  total_leads BIGINT,
  ready_for_enrichment BIGINT,
  added_today BIGINT,
  added_this_week BIGINT,
  average_rating DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_leads,
    COUNT(*) FILTER (WHERE b.ready_for_enrichment = TRUE)::BIGINT AS ready_for_enrichment,
    COUNT(*) FILTER (WHERE DATE(b.first_discovered_at) = CURRENT_DATE)::BIGINT AS added_today,
    COUNT(*) FILTER (WHERE b.first_discovered_at >= CURRENT_DATE - INTERVAL '7 days')::BIGINT AS added_this_week,
    AVG(b.rating) AS average_rating
  FROM businesses b
  WHERE b.lifecycle_stage = 'lead';
END;
$$ LANGUAGE plpgsql;

-- Migration complete
