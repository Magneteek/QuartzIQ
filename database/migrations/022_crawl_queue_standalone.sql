-- ============================================================
-- Standalone Crawl Queue Tables (single-tenant, no FK to organizations/extractions)
-- Run this if migration 002 was never applied or partially failed.
-- ============================================================

-- Drop old tables if they existed with broken FK constraints
DROP TABLE IF EXISTS business_review_crawls CASCADE;
DROP TABLE IF EXISTS crawl_queue CASCADE;

-- Crawl queue: tracks manual review scrape batches
CREATE TABLE crawl_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,                       -- nullable, single-tenant doesn't need this
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

    batch_name VARCHAR(255),
    batch_id UUID NOT NULL,
    priority INTEGER DEFAULT 50,
    position_in_batch INTEGER,

    queued_at TIMESTAMP DEFAULT NOW(),
    scheduled_for TIMESTAMP,

    status VARCHAR(50) DEFAULT 'queued',        -- queued, in_progress, completed, failed, cancelled
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    attempts INTEGER DEFAULT 0,

    crawl_config JSONB DEFAULT '{}',

    reviews_extracted INTEGER DEFAULT 0,
    error_message TEXT,
    apify_cost_usd DECIMAL(10, 4),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_queue_business ON crawl_queue(business_id);
CREATE INDEX idx_queue_batch ON crawl_queue(batch_id);
CREATE INDEX idx_queue_status ON crawl_queue(status);
CREATE INDEX idx_queue_priority ON crawl_queue(priority DESC) WHERE status = 'queued';

-- Partial unique index: prevent duplicate active queue entries per business
CREATE UNIQUE INDEX idx_queue_unique_business ON crawl_queue(business_id, status)
WHERE status IN ('queued', 'in_progress');

-- Crawl history: records every completed review scrape
CREATE TABLE business_review_crawls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    organization_id UUID,                       -- nullable

    crawled_at TIMESTAMP NOT NULL DEFAULT NOW(),
    crawl_duration_seconds INTEGER,

    reviews_found INTEGER DEFAULT 0,
    reviews_new INTEGER DEFAULT 0,
    reviews_duplicate INTEGER DEFAULT 0,

    reviews_since_date DATE,
    is_incremental BOOLEAN DEFAULT FALSE,

    status VARCHAR(50) DEFAULT 'completed',     -- completed, failed, partial
    error_message TEXT,

    apify_cost_usd DECIMAL(10, 4) DEFAULT 0,

    next_recommended_crawl TIMESTAMP,
    crawl_interval_days INTEGER DEFAULT 14,

    crawl_config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_crawls_business ON business_review_crawls(business_id);
CREATE INDEX idx_crawls_date ON business_review_crawls(crawled_at DESC);
CREATE INDEX idx_crawls_next_crawl ON business_review_crawls(next_recommended_crawl);
CREATE INDEX idx_crawls_status ON business_review_crawls(status);
