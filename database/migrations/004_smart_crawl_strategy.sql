-- ============================================================
-- SMART CRAWL STRATEGY MIGRATION
-- Adds fields to optimize review crawling by separating:
--   1. Businesses WITH reviews (immediate crawl value)
--   2. Businesses WITHOUT reviews (periodic check for new reviews)
-- ============================================================

-- Add crawl strategy tracking fields to businesses table
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS last_review_check_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS review_check_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS had_reviews_on_discovery BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS crawl_priority VARCHAR(20) DEFAULT 'standard';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_businesses_crawl_priority ON businesses(crawl_priority);
CREATE INDEX IF NOT EXISTS idx_businesses_last_review_check ON businesses(last_review_check_at);
CREATE INDEX IF NOT EXISTS idx_businesses_zero_reviews ON businesses(reviews_count) WHERE reviews_count = 0;

-- Update existing records to mark which had reviews on discovery
UPDATE businesses
SET had_reviews_on_discovery = CASE
    WHEN reviews_count > 0 THEN TRUE
    ELSE FALSE
END
WHERE had_reviews_on_discovery IS NULL;

-- Set initial crawl priorities based on current review counts
UPDATE businesses
SET crawl_priority = CASE
    WHEN reviews_count >= 500 THEN 'high'
    WHEN reviews_count >= 100 THEN 'medium'
    WHEN reviews_count > 0 THEN 'standard'
    ELSE 'low'
END
WHERE crawl_priority = 'standard';

-- Set last_review_check_at for businesses with no reviews to their discovery date
UPDATE businesses
SET last_review_check_at = first_discovered_at
WHERE reviews_count = 0 OR reviews_count IS NULL;

-- Create a view for businesses ready for review checking
CREATE OR REPLACE VIEW businesses_ready_for_review_check AS
SELECT
    id,
    place_id,
    name,
    category,
    city,
    reviews_count,
    crawl_priority,
    last_review_check_at,
    review_check_count,
    EXTRACT(DAY FROM NOW() - last_review_check_at)::INTEGER as days_since_check,
    CASE
        WHEN reviews_count = 0 AND (last_review_check_at IS NULL OR last_review_check_at < NOW() - INTERVAL '30 days') THEN TRUE
        ELSE FALSE
    END as ready_for_review_check
FROM businesses
WHERE status = 'active';

-- Create a view for optimal crawl targets (businesses with reviews)
CREATE OR REPLACE VIEW businesses_optimal_crawl_targets AS
SELECT
    b.id,
    b.place_id,
    b.name,
    b.category,
    b.city,
    b.reviews_count,
    b.rating,
    b.crawl_priority,
    b.last_scraped_at,
    b.scrape_count,
    EXTRACT(DAY FROM NOW() - COALESCE(b.last_scraped_at, b.first_discovered_at))::INTEGER as days_since_crawl,
    CASE
        WHEN b.crawl_priority = 'high' THEN 1
        WHEN b.crawl_priority = 'medium' THEN 2
        WHEN b.crawl_priority = 'standard' THEN 3
        ELSE 4
    END as priority_rank
FROM businesses b
WHERE b.status = 'active'
  AND b.reviews_count > 0  -- Only businesses with reviews
ORDER BY priority_rank ASC, b.reviews_count DESC;

COMMENT ON COLUMN businesses.last_review_check_at IS 'Last time we checked if this business has gained reviews (for 0-review businesses)';
COMMENT ON COLUMN businesses.review_check_count IS 'Number of times we checked for new reviews (for 0-review monitoring)';
COMMENT ON COLUMN businesses.had_reviews_on_discovery IS 'Whether this business had reviews when first discovered';
COMMENT ON COLUMN businesses.crawl_priority IS 'Crawl priority: high (500+), medium (100-499), standard (1-99), low (0 reviews)';
