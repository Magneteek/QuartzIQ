-- =====================================================
-- Migration: 013 - Cache Optimization & GHL Tracking
-- Purpose: Track place_id cache efficiency and GHL sends
-- Cost Impact: Maximize $0.006 savings per cached business
-- =====================================================

-- Add cache efficiency tracking fields to businesses table
ALTER TABLE businesses

-- Cache efficiency metrics
ADD COLUMN IF NOT EXISTS place_id_source VARCHAR(50) DEFAULT 'scraped',
ADD COLUMN IF NOT EXISTS times_reused INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cache_savings_usd DECIMAL(10,2) GENERATED ALWAYS AS (
  times_reused * 0.006
) STORED,

-- Discovery crawl tracking (40-60 day cycle)
ADD COLUMN IF NOT EXISTS last_discovery_crawl TIMESTAMP,
ADD COLUMN IF NOT EXISTS next_discovery_crawl TIMESTAMP,
ADD COLUMN IF NOT EXISTS discovery_crawl_count INTEGER DEFAULT 0,

-- Review crawl tracking (weekly for customers)
ADD COLUMN IF NOT EXISTS last_review_crawl TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_review_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_reviews_crawled INTEGER DEFAULT 0,

-- GoHighLevel integration tracking (send once per business)
ADD COLUMN IF NOT EXISTS ghl_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ghl_sent_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS ghl_contact_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS ghl_sent_count INTEGER DEFAULT 0;

-- Add indexes for cache performance queries
CREATE INDEX IF NOT EXISTS idx_businesses_place_id_source ON businesses(place_id_source);
CREATE INDEX IF NOT EXISTS idx_businesses_times_reused ON businesses(times_reused);
CREATE INDEX IF NOT EXISTS idx_businesses_next_discovery_crawl ON businesses(next_discovery_crawl);
CREATE INDEX IF NOT EXISTS idx_businesses_ghl_sent ON businesses(ghl_sent);

-- Add comment explaining place_id_source values
COMMENT ON COLUMN businesses.place_id_source IS 'How place_id was obtained: scraped (new discovery), cached (reused), imported (CSV/bulk)';

-- =====================================================
-- Crawl Cost Tracking Table
-- Purpose: Track daily/weekly crawl costs and ROI
-- =====================================================

CREATE TABLE IF NOT EXISTS crawl_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),

  -- Crawl metadata
  crawl_date DATE DEFAULT CURRENT_DATE,
  category VARCHAR(255),
  location VARCHAR(255),
  crawl_type VARCHAR(50), -- 'discovery' or 'monitoring'

  -- Business discovery costs (expensive: $0.006 per business)
  new_businesses_found INTEGER DEFAULT 0,
  cached_businesses_used INTEGER DEFAULT 0,
  business_discovery_cost_usd DECIMAL(10,2) GENERATED ALWAYS AS (
    new_businesses_found * 0.006
  ) STORED,
  cache_savings_usd DECIMAL(10,2) GENERATED ALWAYS AS (
    cached_businesses_used * 0.006
  ) STORED,

  -- Review costs (cheap: $0.0005 per review)
  reviews_scraped INTEGER DEFAULT 0,
  review_cost_usd DECIMAL(10,2) GENERATED ALWAYS AS (
    reviews_scraped * 0.0005
  ) STORED,

  -- Totals
  total_cost_usd DECIMAL(10,2) GENERATED ALWAYS AS (
    (new_businesses_found * 0.006) + (reviews_scraped * 0.0005)
  ) STORED,

  actual_cost_usd DECIMAL(10,2) GENERATED ALWAYS AS (
    (new_businesses_found * 0.006) + (reviews_scraped * 0.0005)
  ) STORED,

  potential_cost_without_cache_usd DECIMAL(10,2) GENERATED ALWAYS AS (
    (new_businesses_found + cached_businesses_used) * 0.006 + (reviews_scraped * 0.0005)
  ) STORED,

  -- ROI tracking
  leads_generated INTEGER DEFAULT 0,
  cost_per_lead_usd DECIMAL(10,2),

  -- Cache efficiency
  cache_hit_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN (new_businesses_found + cached_businesses_used) > 0
      THEN (cached_businesses_used::DECIMAL / (new_businesses_found + cached_businesses_used) * 100)
      ELSE 0
    END
  ) STORED
);

-- Add indexes for crawl_costs queries
CREATE INDEX IF NOT EXISTS idx_crawl_costs_date ON crawl_costs(crawl_date);
CREATE INDEX IF NOT EXISTS idx_crawl_costs_type ON crawl_costs(crawl_type);
CREATE INDEX IF NOT EXISTS idx_crawl_costs_category ON crawl_costs(category);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function: Get current cache hit rate
CREATE OR REPLACE FUNCTION get_cache_hit_rate(
  days_back INTEGER DEFAULT 7
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  total_cached INTEGER;
  total_new INTEGER;
  hit_rate DECIMAL(5,2);
BEGIN
  SELECT
    COALESCE(SUM(cached_businesses_used), 0),
    COALESCE(SUM(new_businesses_found), 0)
  INTO total_cached, total_new
  FROM crawl_costs
  WHERE crawl_date >= CURRENT_DATE - days_back;

  IF (total_cached + total_new) > 0 THEN
    hit_rate := (total_cached::DECIMAL / (total_cached + total_new) * 100);
  ELSE
    hit_rate := 0;
  END IF;

  RETURN hit_rate;
END;
$$ LANGUAGE plpgsql;

-- Function: Get total cache savings
CREATE OR REPLACE FUNCTION get_total_cache_savings()
RETURNS TABLE(
  total_savings_usd DECIMAL(10,2),
  total_reuses INTEGER,
  avg_reuses_per_business DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(cache_savings_usd), 0) as total_savings_usd,
    COALESCE(SUM(times_reused), 0) as total_reuses,
    COALESCE(AVG(times_reused), 0) as avg_reuses_per_business
  FROM businesses
  WHERE times_reused > 0;
END;
$$ LANGUAGE plpgsql;

-- Function: Get businesses due for discovery crawl
CREATE OR REPLACE FUNCTION get_businesses_due_for_discovery(
  limit_count INTEGER DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  place_id VARCHAR(255),
  name VARCHAR(500),
  city VARCHAR(255),
  last_discovery_crawl TIMESTAMP,
  days_since_last_crawl INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.place_id,
    b.name,
    b.city,
    b.last_discovery_crawl,
    EXTRACT(DAY FROM (NOW() - b.last_discovery_crawl))::INTEGER as days_since_last_crawl
  FROM businesses b
  WHERE
    b.next_discovery_crawl <= NOW()
    OR b.next_discovery_crawl IS NULL
  ORDER BY
    b.last_discovery_crawl ASC NULLS FIRST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Get customers due for monitoring
CREATE OR REPLACE FUNCTION get_customers_due_for_monitoring(
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  place_id VARCHAR(255),
  name VARCHAR(500),
  monitoring_frequency_hours INTEGER,
  last_review_crawl TIMESTAMP,
  hours_since_last_crawl DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.place_id,
    b.name,
    b.monitoring_frequency_hours,
    b.last_review_crawl,
    EXTRACT(EPOCH FROM (NOW() - b.last_review_crawl)) / 3600 as hours_since_last_crawl
  FROM businesses b
  WHERE
    b.is_paying_customer = TRUE
    AND b.monitoring_enabled = TRUE
    AND (
      b.last_review_crawl IS NULL
      OR (NOW() - b.last_review_crawl) > (b.monitoring_frequency_hours || ' hours')::INTERVAL
    )
  ORDER BY
    b.last_review_crawl ASC NULLS FIRST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Validation Constraints
-- =====================================================

-- Ensure place_id_source has valid values
ALTER TABLE businesses
ADD CONSTRAINT valid_place_id_source CHECK (
  place_id_source IN ('scraped', 'cached', 'imported')
);

-- Ensure crawl_type has valid values
ALTER TABLE crawl_costs
ADD CONSTRAINT valid_crawl_type CHECK (
  crawl_type IN ('discovery', 'monitoring')
);

-- =====================================================
-- Initial Data Updates
-- =====================================================

-- Set all existing businesses as 'scraped' (first time discovery)
UPDATE businesses
SET place_id_source = 'scraped',
    times_reused = 0
WHERE place_id_source IS NULL;

-- =====================================================
-- Comments and Documentation
-- =====================================================

COMMENT ON TABLE crawl_costs IS 'Tracks daily crawl costs and cache efficiency for ROI analysis';
COMMENT ON COLUMN crawl_costs.cache_hit_rate IS 'Percentage of businesses found in cache vs new scrapes (target: >80%)';
COMMENT ON COLUMN businesses.times_reused IS 'Number of times this place_id was reused from cache (each reuse saves $0.006)';
COMMENT ON COLUMN businesses.cache_savings_usd IS 'Total cost savings from cache reuse (times_reused * $0.006)';
COMMENT ON COLUMN businesses.ghl_sent IS 'Whether contact was sent to GoHighLevel (should only happen once per business)';
COMMENT ON COLUMN businesses.ghl_sent_count IS 'Safety counter: should always be 0 or 1 (tracks duplicate send prevention)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 013 completed successfully';
  RAISE NOTICE '📊 Cache tracking fields added to businesses table';
  RAISE NOTICE '💰 Cost tracking table created with generated columns';
  RAISE NOTICE '🎯 Target cache hit rate: >80%% (currently saves $0.006 per reuse)';
  RAISE NOTICE '⚡ Helper functions created for monitoring and reporting';
END $$;
