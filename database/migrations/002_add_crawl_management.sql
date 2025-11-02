-- ============================================================
-- BUSINESS REVIEW CRAWL MANAGEMENT MIGRATION
-- Adds crawl tracking, queue management, and incremental updates
-- ============================================================

-- ============================================================
-- BUSINESS REVIEW CRAWLS TRACKING
-- Tracks every crawl session per business for incremental updates
-- ============================================================

CREATE TABLE IF NOT EXISTS business_review_crawls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    extraction_id UUID REFERENCES extractions(id) ON DELETE SET NULL,

    -- Crawl Timing
    crawled_at TIMESTAMP NOT NULL DEFAULT NOW(),
    crawl_duration_seconds INTEGER,

    -- Results
    reviews_found INTEGER DEFAULT 0,        -- Total reviews found in this crawl
    reviews_new INTEGER DEFAULT 0,          -- Actually new reviews (not in cache)
    reviews_duplicate INTEGER DEFAULT 0,    -- Already in cache (skipped)

    -- Incremental Crawl Support
    reviews_since_date DATE,                -- Only fetch reviews after this date
    is_incremental BOOLEAN DEFAULT FALSE,   -- Was this an incremental crawl?

    -- Status
    status VARCHAR(50) DEFAULT 'completed', -- completed, failed, partial
    error_message TEXT,

    -- Cost Tracking
    apify_cost_usd DECIMAL(10, 4) DEFAULT 0,

    -- Scheduling
    next_recommended_crawl TIMESTAMP,       -- When to crawl again (crawled_at + interval)
    crawl_interval_days INTEGER DEFAULT 14, -- Re-crawl interval for this business

    -- Metadata
    crawl_config JSONB DEFAULT '{}',        -- Crawl parameters used
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_crawls_business ON business_review_crawls(business_id);
CREATE INDEX idx_crawls_org ON business_review_crawls(organization_id);
CREATE INDEX idx_crawls_date ON business_review_crawls(crawled_at DESC);
CREATE INDEX idx_crawls_next_crawl ON business_review_crawls(next_recommended_crawl);
CREATE INDEX idx_crawls_extraction ON business_review_crawls(extraction_id);
CREATE INDEX idx_crawls_status ON business_review_crawls(status);

-- Function to get last crawl for a business
CREATE OR REPLACE FUNCTION get_last_crawl(p_business_id UUID)
RETURNS TABLE (
    last_crawled_at TIMESTAMP,
    days_since_crawl INTEGER,
    reviews_in_last_crawl INTEGER,
    next_recommended TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        brc.crawled_at,
        EXTRACT(DAY FROM NOW() - brc.crawled_at)::INTEGER,
        brc.reviews_found,
        brc.next_recommended_crawl
    FROM business_review_crawls brc
    WHERE brc.business_id = p_business_id
      AND brc.status = 'completed'
    ORDER BY brc.crawled_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CRAWL QUEUE MANAGEMENT
-- Batch queue system for controlled crawling
-- ============================================================

CREATE TABLE IF NOT EXISTS crawl_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

    -- Queue Management
    batch_name VARCHAR(255),                -- "Amsterdam Tandarts - Batch 1"
    batch_id UUID NOT NULL,                 -- Group businesses into batches
    priority INTEGER DEFAULT 50,            -- 0-100, higher = crawl sooner
    position_in_batch INTEGER,              -- Order within batch

    -- Scheduling
    queued_at TIMESTAMP DEFAULT NOW(),
    scheduled_for TIMESTAMP,                -- When to execute (null = ASAP)

    -- Status
    status VARCHAR(50) DEFAULT 'queued',    -- queued, in_progress, completed, failed, cancelled
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    attempts INTEGER DEFAULT 0,             -- Retry tracking

    -- Crawl Configuration
    crawl_config JSONB DEFAULT '{}',        -- maxReviewsPerBusiness, maxReviewStars, etc.

    -- Results
    reviews_extracted INTEGER DEFAULT 0,
    error_message TEXT,
    apify_cost_usd DECIMAL(10, 4),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for queue operations
CREATE INDEX idx_queue_org ON crawl_queue(organization_id);
CREATE INDEX idx_queue_business ON crawl_queue(business_id);
CREATE INDEX idx_queue_batch ON crawl_queue(batch_id);
CREATE INDEX idx_queue_status ON crawl_queue(status);
CREATE INDEX idx_queue_priority ON crawl_queue(priority DESC) WHERE status = 'queued';
CREATE INDEX idx_queue_scheduled ON crawl_queue(scheduled_for) WHERE status = 'queued';
CREATE INDEX idx_queue_created ON crawl_queue(created_at DESC);

-- Partial unique index: Prevent duplicate queuing of same business
CREATE UNIQUE INDEX idx_queue_unique_business ON crawl_queue(business_id, status)
WHERE status IN ('queued', 'in_progress');

-- Function to get batch statistics
CREATE OR REPLACE FUNCTION get_batch_stats(p_batch_id UUID)
RETURNS TABLE (
    total_businesses INTEGER,
    completed INTEGER,
    failed INTEGER,
    queued INTEGER,
    in_progress INTEGER,
    total_reviews INTEGER,
    total_cost DECIMAL,
    progress_percent DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'queued')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'in_progress')::INTEGER,
        COALESCE(SUM(reviews_extracted), 0)::INTEGER,
        COALESCE(SUM(apify_cost_usd), 0)::DECIMAL,
        CASE
            WHEN COUNT(*) > 0 THEN
                ROUND((COUNT(*) FILTER (WHERE status IN ('completed', 'failed'))::DECIMAL / COUNT(*)) * 100, 1)
            ELSE 0
        END
    FROM crawl_queue
    WHERE batch_id = p_batch_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- HELPER VIEWS FOR COMMON QUERIES
-- ============================================================

-- View: Businesses with crawl status
CREATE OR REPLACE VIEW businesses_with_crawl_status AS
SELECT
    b.id,
    b.place_id,
    b.name,
    b.category,
    b.city,
    b.country_code,
    b.address,
    b.rating,
    b.reviews_count,
    b.phone,
    b.website,
    b.google_maps_url,
    -- Last crawl info
    lc.last_crawled_at,
    lc.days_since_crawl,
    lc.reviews_in_last_crawl,
    lc.next_recommended,
    -- Crawl status
    CASE
        WHEN lc.last_crawled_at IS NULL THEN 'never_crawled'
        WHEN lc.days_since_crawl > 30 THEN 'overdue'
        WHEN lc.days_since_crawl > 14 THEN 'due'
        WHEN lc.days_since_crawl > 7 THEN 'soon'
        ELSE 'recent'
    END as crawl_status,
    -- Queue status
    EXISTS(
        SELECT 1 FROM crawl_queue cq
        WHERE cq.business_id = b.id
          AND cq.status IN ('queued', 'in_progress')
    ) as in_queue
FROM businesses b
LEFT JOIN LATERAL (
    SELECT * FROM get_last_crawl(b.id)
) lc ON TRUE;

-- View: Active crawl batches summary
CREATE OR REPLACE VIEW active_crawl_batches AS
SELECT
    cq.batch_id,
    cq.batch_name,
    cq.organization_id,
    MIN(cq.queued_at) as queued_at,
    MIN(cq.scheduled_for) as scheduled_for,
    bs.total_businesses,
    bs.completed,
    bs.failed,
    bs.queued,
    bs.in_progress,
    bs.total_reviews,
    bs.total_cost,
    bs.progress_percent,
    CASE
        WHEN bs.in_progress > 0 THEN 'in_progress'
        WHEN bs.queued > 0 THEN 'queued'
        WHEN bs.completed = bs.total_businesses THEN 'completed'
        ELSE 'mixed'
    END as batch_status
FROM crawl_queue cq
CROSS JOIN LATERAL get_batch_stats(cq.batch_id) bs
GROUP BY
    cq.batch_id,
    cq.batch_name,
    cq.organization_id,
    bs.total_businesses,
    bs.completed,
    bs.failed,
    bs.queued,
    bs.in_progress,
    bs.total_reviews,
    bs.total_cost,
    bs.progress_percent;

-- ============================================================
-- DATA MIGRATION
-- Backfill existing data with initial crawl records
-- ============================================================

-- Create crawl records for businesses that have reviews
-- (Assuming they were "crawled" when first review was extracted)
-- Only runs if there is at least one organization in the database
DO $$
DECLARE
    default_org_id UUID;
BEGIN
    -- Get first organization or create a default one
    SELECT id INTO default_org_id FROM organizations LIMIT 1;

    IF default_org_id IS NULL THEN
        RAISE NOTICE 'No organizations found, skipping data backfill';
    ELSE
        RAISE NOTICE 'Using organization % for backfill', default_org_id;

        INSERT INTO business_review_crawls (
            business_id,
            organization_id,
            crawled_at,
            reviews_found,
            reviews_new,
            is_incremental,
            status,
            next_recommended_crawl
        )
        SELECT DISTINCT ON (r.business_id)
            r.business_id,
            default_org_id as organization_id,
            MIN(r.extracted_at) as crawled_at,
            COUNT(r.id)::INTEGER as reviews_found,
            COUNT(r.id)::INTEGER as reviews_new,
            FALSE as is_incremental,
            'completed' as status,
            MIN(r.extracted_at) + INTERVAL '14 days' as next_recommended_crawl
        FROM reviews r
        WHERE r.business_id IN (SELECT id FROM businesses)
        GROUP BY r.business_id
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Backfilled % crawl records', (SELECT COUNT(*) FROM business_review_crawls);
    END IF;
END $$;

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON TABLE business_review_crawls IS 'Tracks every crawl session per business for incremental updates and audit trail';
COMMENT ON TABLE crawl_queue IS 'Batch queue system for controlled, scheduled review crawling';
COMMENT ON VIEW businesses_with_crawl_status IS 'Convenient view showing businesses with their last crawl status';
COMMENT ON VIEW active_crawl_batches IS 'Summary of all active crawl batches with progress tracking';

COMMENT ON COLUMN business_review_crawls.is_incremental IS 'TRUE if this crawl only fetched reviews published after last crawl date';
COMMENT ON COLUMN business_review_crawls.next_recommended_crawl IS 'Calculated timestamp when business should be crawled again';
COMMENT ON COLUMN crawl_queue.priority IS 'Priority score 0-100, higher values crawled first';
COMMENT ON COLUMN crawl_queue.position_in_batch IS 'Order within batch for sequential processing';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

-- Verify migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 002 completed successfully!';
    RAISE NOTICE 'Created tables: business_review_crawls, crawl_queue';
    RAISE NOTICE 'Created views: businesses_with_crawl_status, active_crawl_batches';
    RAISE NOTICE 'Created functions: get_last_crawl(), get_batch_stats()';
    RAISE NOTICE 'Backfilled % crawl records from existing reviews', (
        SELECT COUNT(*) FROM business_review_crawls
    );
END $$;
