-- ============================================================
-- ADD ENRICHMENT FIELDS TO BUSINESSES TABLE
-- Migration 005: Store contact enrichment data in businesses table
-- This prevents re-enriching the same businesses multiple times
-- ============================================================

-- Add enrichment columns to businesses table
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS email_enriched VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_confidence VARCHAR(50),
  ADD COLUMN IF NOT EXISTS email_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS owner_first_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS owner_last_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS owner_email_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS owner_title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS owner_linkedin VARCHAR(500),
  ADD COLUMN IF NOT EXISTS facebook_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS twitter_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS youtube_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS enrichment_provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS enrichment_cost_usd DECIMAL(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_quality_score DECIMAL(3,2);

-- Create indexes for fast enrichment lookups
CREATE INDEX IF NOT EXISTS idx_businesses_email_enriched
  ON businesses(email_enriched)
  WHERE email_enriched IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_owner_email
  ON businesses(owner_email)
  WHERE owner_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_last_enriched
  ON businesses(last_enriched_at);

CREATE INDEX IF NOT EXISTS idx_businesses_enrichment_provider
  ON businesses(enrichment_provider)
  WHERE enrichment_provider IS NOT NULL;

-- Create index for finding businesses that need enrichment
CREATE INDEX IF NOT EXISTS idx_businesses_needs_enrichment
  ON businesses(last_enriched_at, website)
  WHERE last_enriched_at IS NULL AND website IS NOT NULL;

-- ============================================================
-- ADD REVIEW MOMENTUM TRACKING
-- ============================================================

-- Add review momentum cache table
CREATE TABLE IF NOT EXISTS business_review_momentum (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

    -- Analysis period
    analysis_period_days INTEGER NOT NULL DEFAULT 30,
    analysis_date TIMESTAMP DEFAULT NOW(),

    -- Review counts
    total_reviews INTEGER DEFAULT 0,
    reviews_in_period INTEGER DEFAULT 0,
    reviews_in_previous_period INTEGER DEFAULT 0,

    -- Velocity metrics
    review_velocity DECIMAL(10,2), -- Reviews per day
    percent_change DECIMAL(10,2), -- % change vs previous period
    trend VARCHAR(20), -- 'increasing', 'decreasing', 'stable', 'spike'

    -- Quality metrics
    avg_rating_in_period DECIMAL(3,2),
    avg_rating_previous_period DECIMAL(3,2),
    rating_trend VARCHAR(20), -- 'improving', 'declining', 'stable'

    -- Response metrics
    owner_response_rate DECIMAL(5,2), -- % of reviews with owner response
    avg_response_time_hours DECIMAL(10,2),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Unique constraint: one momentum record per business per period
    CONSTRAINT unique_momentum_per_period UNIQUE(business_id, analysis_period_days, analysis_date)
);

-- Indexes for momentum queries
CREATE INDEX IF NOT EXISTS idx_momentum_business
  ON business_review_momentum(business_id);

CREATE INDEX IF NOT EXISTS idx_momentum_trend
  ON business_review_momentum(trend);

CREATE INDEX IF NOT EXISTS idx_momentum_velocity
  ON business_review_momentum(review_velocity DESC);

CREATE INDEX IF NOT EXISTS idx_momentum_analysis_date
  ON business_review_momentum(analysis_date DESC);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to check if business needs enrichment
CREATE OR REPLACE FUNCTION needs_enrichment(
  p_business_id UUID,
  p_max_age_days INTEGER DEFAULT 90
) RETURNS BOOLEAN AS $$
DECLARE
  v_last_enriched TIMESTAMP;
  v_has_website BOOLEAN;
BEGIN
  SELECT last_enriched_at, (website IS NOT NULL)
  INTO v_last_enriched, v_has_website
  FROM businesses
  WHERE id = p_business_id;

  -- Needs enrichment if:
  -- 1. Has a website AND
  -- 2. Never enriched OR enriched more than max_age_days ago
  RETURN v_has_website AND (
    v_last_enriched IS NULL OR
    v_last_enriched < NOW() - (p_max_age_days || ' days')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get enrichment coverage stats
CREATE OR REPLACE FUNCTION get_enrichment_coverage()
RETURNS TABLE(
  total_businesses BIGINT,
  with_email BIGINT,
  with_owner_data BIGINT,
  with_social_media BIGINT,
  enriched_last_30_days BIGINT,
  enriched_last_90_days BIGINT,
  never_enriched BIGINT,
  avg_enrichment_cost DECIMAL(10,4)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_businesses,
    COUNT(email_enriched) as with_email,
    COUNT(CASE WHEN owner_email IS NOT NULL OR owner_first_name IS NOT NULL THEN 1 END) as with_owner_data,
    COUNT(CASE WHEN facebook_url IS NOT NULL OR linkedin_url IS NOT NULL OR instagram_url IS NOT NULL THEN 1 END) as with_social_media,
    COUNT(CASE WHEN last_enriched_at >= NOW() - INTERVAL '30 days' THEN 1 END) as enriched_last_30_days,
    COUNT(CASE WHEN last_enriched_at >= NOW() - INTERVAL '90 days' THEN 1 END) as enriched_last_90_days,
    COUNT(CASE WHEN last_enriched_at IS NULL AND website IS NOT NULL THEN 1 END) as never_enriched,
    AVG(enrichment_cost_usd) as avg_enrichment_cost
  FROM businesses;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 005 completed: Enrichment fields added to businesses table';
  RAISE NOTICE '📊 Run SELECT * FROM get_enrichment_coverage() to see current enrichment stats';
END $$;
