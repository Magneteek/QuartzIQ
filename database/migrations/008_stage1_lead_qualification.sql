-- Migration 008: Stage 1 Lead Qualification Schema
-- Purpose: Add fields and structure needed for VA lead qualification workflow

-- 1. Add VA-specific fields to businesses table (if not exists)
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'scraper', 'import'
ADD COLUMN IF NOT EXISTS entry_method VARCHAR(50), -- 'manual_entry', 'google_maps_url', 'csv_import'
ADD COLUMN IF NOT EXISTS va_notes TEXT, -- Notes from VA during qualification
ADD COLUMN IF NOT EXISTS qualification_date TIMESTAMP, -- When moved to 'lead' stage
ADD COLUMN IF NOT EXISTS qualified_by UUID REFERENCES users(id) ON DELETE SET NULL, -- VA who qualified
ADD COLUMN IF NOT EXISTS ready_for_enrichment BOOLEAN DEFAULT FALSE, -- Ready for Stage 2
ADD COLUMN IF NOT EXISTS enrichment_priority INTEGER DEFAULT 50; -- 0-100, higher = more urgent

-- 2. Add indexes for lead queries
CREATE INDEX IF NOT EXISTS idx_businesses_lifecycle ON businesses(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_businesses_data_source ON businesses(data_source);
CREATE INDEX IF NOT EXISTS idx_businesses_ready_enrichment ON businesses(ready_for_enrichment);
CREATE INDEX IF NOT EXISTS idx_businesses_qualified_by ON businesses(qualified_by);
CREATE INDEX IF NOT EXISTS idx_businesses_qualification_date ON businesses(qualification_date DESC);

-- 3. Add enrichment status to businesses (for Stage 2 tracking)
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS enrichment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
ADD COLUMN IF NOT EXISTS enrichment_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS enrichment_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS enriched_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS enrichment_source VARCHAR(50), -- 'manual', 'apollo', 'apify', 'multiple'
ADD COLUMN IF NOT EXISTS enrichment_confidence INTEGER; -- 0-100, confidence in enriched data

-- 4. Create lead activity log table
CREATE TABLE IF NOT EXISTS lead_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- 'created', 'updated', 'qualified', 'moved_to_enrichment', etc.
  old_values JSONB, -- Previous values
  new_values JSONB, -- Updated values
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_activity_business ON lead_activity_log(business_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_user ON lead_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_created ON lead_activity_log(created_at DESC);

-- 5. Helper function to get leads for VA dashboard
CREATE OR REPLACE FUNCTION get_leads_for_va(
  p_limit INTEGER DEFAULT 15,
  p_offset INTEGER DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_sort_by VARCHAR DEFAULT 'created_at',
  p_sort_order VARCHAR DEFAULT 'DESC'
) RETURNS TABLE (
  id UUID,
  business_name VARCHAR,
  place_id VARCHAR,
  address TEXT,
  city VARCHAR,
  country VARCHAR,
  phone VARCHAR,
  website VARCHAR,
  rating DECIMAL,
  total_reviews INTEGER,
  lifecycle_stage VARCHAR,
  data_source VARCHAR,
  qualification_date TIMESTAMP,
  qualified_by_name VARCHAR,
  ready_for_enrichment BOOLEAN,
  review_count BIGINT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.business_name,
    b.place_id,
    b.address,
    b.city,
    b.country,
    b.phone,
    b.website,
    b.rating,
    b.total_reviews,
    b.lifecycle_stage,
    b.data_source,
    b.qualification_date,
    u.name AS qualified_by_name,
    b.ready_for_enrichment,
    COUNT(r.id) AS review_count,
    b.created_at,
    b.updated_at
  FROM businesses b
  LEFT JOIN users u ON b.qualified_by = u.id
  LEFT JOIN reviews r ON b.id = r.business_id
  WHERE b.lifecycle_stage = 'lead'
    AND (p_search IS NULL OR b.business_name ILIKE '%' || p_search || '%')
  GROUP BY b.id, u.name
  ORDER BY
    CASE WHEN p_sort_by = 'business_name' AND p_sort_order = 'ASC' THEN b.business_name END ASC,
    CASE WHEN p_sort_by = 'business_name' AND p_sort_order = 'DESC' THEN b.business_name END DESC,
    CASE WHEN p_sort_by = 'created_at' AND p_sort_order = 'ASC' THEN b.created_at END ASC,
    CASE WHEN p_sort_by = 'created_at' AND p_sort_order = 'DESC' THEN b.created_at END DESC,
    CASE WHEN p_sort_by = 'rating' AND p_sort_order = 'ASC' THEN b.rating END ASC,
    CASE WHEN p_sort_by = 'rating' AND p_sort_order = 'DESC' THEN b.rating END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 6. Helper function to get lead statistics
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
    COUNT(*) FILTER (WHERE ready_for_enrichment = TRUE)::BIGINT AS ready_for_enrichment,
    COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)::BIGINT AS added_today,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::BIGINT AS added_this_week,
    AVG(rating) AS average_rating
  FROM businesses
  WHERE lifecycle_stage = 'lead';
END;
$$ LANGUAGE plpgsql;

-- 7. Helper function to log lead activity
CREATE OR REPLACE FUNCTION log_lead_activity(
  p_business_id UUID,
  p_user_id UUID,
  p_action VARCHAR,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO lead_activity_log (
    business_id,
    user_id,
    action,
    old_values,
    new_values,
    notes
  ) VALUES (
    p_business_id,
    p_user_id,
    p_action,
    p_old_values,
    p_new_values,
    p_notes
  ) RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql;

-- Migration complete
-- Next steps:
-- 1. Apply migration: npx ts-node scripts/run-migration-008.ts
-- 2. Build Stage 1 UI components
-- 3. Create API routes for lead management
