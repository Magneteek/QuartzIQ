-- ============================================================
-- APOLLO.IO CONTACT ENRICHMENT MIGRATION
-- Extends contact_enrichments table with Apollo tracking
-- ============================================================

-- Add Apollo-specific fields to contact_enrichments table
ALTER TABLE contact_enrichments
ADD COLUMN IF NOT EXISTS apollo_person_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS apollo_search_cost DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS apollo_enrich_cost DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS reveal_method VARCHAR(50), -- 'claude_only', 'enrich_only', 'search_then_enrich'
ADD COLUMN IF NOT EXISTS title VARCHAR(255), -- Job title (CEO, Owner, etc.)
ADD COLUMN IF NOT EXISTS seniority VARCHAR(100), -- owner, founder, c_suite, director
ADD COLUMN IF NOT EXISTS enrichment_status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMP;

-- Create index for Apollo person ID
CREATE INDEX IF NOT EXISTS idx_contact_enrichments_apollo_person
ON contact_enrichments(apollo_person_id);

-- Create index for enrichment status
CREATE INDEX IF NOT EXISTS idx_contact_enrichments_status
ON contact_enrichments(enrichment_status);

-- Create index for reveal method (cost analysis)
CREATE INDEX IF NOT EXISTS idx_contact_enrichments_reveal_method
ON contact_enrichments(reveal_method);

-- ============================================================
-- ENRICHMENT QUEUE TABLE
-- Queue system for async enrichment processing
-- ============================================================

CREATE TABLE IF NOT EXISTS enrichment_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

    -- Queue Management
    priority INTEGER DEFAULT 50, -- 0-100, higher = process sooner
    status VARCHAR(50) DEFAULT 'queued', -- queued, processing, completed, failed

    -- Scheduling
    queued_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Configuration
    target_executive_count INTEGER DEFAULT 1, -- How many executives to find
    enrichment_config JSONB DEFAULT '{}',

    -- Results
    executives_found INTEGER DEFAULT 0,
    total_api_calls INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10,4) DEFAULT 0,

    -- Error Handling
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Prevent duplicate queuing
    CONSTRAINT unique_business_in_queue UNIQUE(business_id, status)
);

-- Indexes for queue operations
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_org
ON enrichment_queue(organization_id);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_business
ON enrichment_queue(business_id);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status
ON enrichment_queue(status);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_priority
ON enrichment_queue(priority DESC)
WHERE status = 'queued';

-- ============================================================
-- APOLLO API USAGE TRACKING
-- Track individual Apollo API calls for cost analysis
-- ============================================================

CREATE TABLE IF NOT EXISTS apollo_api_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    enrichment_queue_id UUID REFERENCES enrichment_queue(id) ON DELETE SET NULL,

    -- API Call Details
    api_endpoint VARCHAR(100) NOT NULL, -- 'search', 'enrich', 'bulk_enrich'
    request_params JSONB DEFAULT '{}',
    response_data JSONB DEFAULT '{}',

    -- Cost Tracking
    credits_used DECIMAL(10,4) DEFAULT 0,
    cost_usd DECIMAL(10,4) DEFAULT 0,

    -- Status
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    http_status_code INTEGER,

    -- Timing
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for API usage analysis
CREATE INDEX IF NOT EXISTS idx_apollo_api_org
ON apollo_api_log(organization_id);

CREATE INDEX IF NOT EXISTS idx_apollo_api_business
ON apollo_api_log(business_id);

CREATE INDEX IF NOT EXISTS idx_apollo_api_endpoint
ON apollo_api_log(api_endpoint);

CREATE INDEX IF NOT EXISTS idx_apollo_api_created
ON apollo_api_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_apollo_api_success
ON apollo_api_log(success);

-- ============================================================
-- USEFUL FUNCTIONS
-- ============================================================

-- Function to get enrichment statistics
CREATE OR REPLACE FUNCTION get_enrichment_stats(p_org_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_businesses INTEGER,
    total_enrichments INTEGER,
    success_rate DECIMAL,
    total_api_calls INTEGER,
    total_cost DECIMAL,
    avg_cost_per_business DECIMAL,
    claude_only_count INTEGER,
    enrich_only_count INTEGER,
    search_then_enrich_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT eq.business_id)::INTEGER as total_businesses,
        COUNT(ce.id)::INTEGER as total_enrichments,
        CASE
            WHEN COUNT(ce.id) > 0
            THEN ROUND((COUNT(ce.id) FILTER (WHERE ce.enrichment_status = 'completed')::DECIMAL / COUNT(ce.id)) * 100, 1)
            ELSE 0
        END as success_rate,
        COALESCE(SUM(eq.total_api_calls), 0)::INTEGER as total_api_calls,
        COALESCE(SUM(eq.total_cost_usd), 0)::DECIMAL as total_cost,
        CASE
            WHEN COUNT(DISTINCT eq.business_id) > 0
            THEN ROUND(COALESCE(SUM(eq.total_cost_usd), 0) / COUNT(DISTINCT eq.business_id), 4)
            ELSE 0
        END as avg_cost_per_business,
        COUNT(ce.id) FILTER (WHERE ce.reveal_method = 'claude_only')::INTEGER,
        COUNT(ce.id) FILTER (WHERE ce.reveal_method = 'enrich_only')::INTEGER,
        COUNT(ce.id) FILTER (WHERE ce.reveal_method = 'search_then_enrich')::INTEGER
    FROM enrichment_queue eq
    LEFT JOIN contact_enrichments ce ON ce.business_id = eq.business_id
    WHERE eq.organization_id = p_org_id
      AND eq.created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to get next queued enrichment job
CREATE OR REPLACE FUNCTION get_next_enrichment_job()
RETURNS TABLE (
    queue_id UUID,
    business_id UUID,
    business_name VARCHAR,
    business_website VARCHAR,
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        eq.id,
        eq.business_id,
        b.name,
        b.website,
        eq.priority
    FROM enrichment_queue eq
    INNER JOIN businesses b ON b.id = eq.business_id
    WHERE eq.status = 'queued'
    ORDER BY eq.priority DESC, eq.queued_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED; -- Prevent race conditions
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp for enrichment_queue
CREATE OR REPLACE FUNCTION update_enrichment_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_enrichment_queue_updated_at
BEFORE UPDATE ON enrichment_queue
FOR EACH ROW EXECUTE FUNCTION update_enrichment_queue_timestamp();

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- View: Enrichment queue with business details
CREATE OR REPLACE VIEW enrichment_queue_detailed AS
SELECT
    eq.id as queue_id,
    eq.status,
    eq.priority,
    eq.queued_at,
    eq.completed_at,
    eq.executives_found,
    eq.total_cost_usd,
    b.id as business_id,
    b.name as business_name,
    b.website as business_website,
    b.category,
    b.city,
    b.rating,
    o.name as organization_name,
    EXTRACT(EPOCH FROM (NOW() - eq.queued_at))::INTEGER as wait_time_seconds
FROM enrichment_queue eq
INNER JOIN businesses b ON b.id = eq.business_id
INNER JOIN organizations o ON o.id = eq.organization_id;

-- View: Apollo API usage summary
CREATE OR REPLACE VIEW apollo_api_usage_summary AS
SELECT
    DATE(created_at) as date,
    organization_id,
    api_endpoint,
    COUNT(*) as call_count,
    SUM(credits_used) as total_credits,
    SUM(cost_usd) as total_cost,
    AVG(duration_ms) as avg_duration_ms,
    COUNT(*) FILTER (WHERE success = TRUE) as successful_calls,
    COUNT(*) FILTER (WHERE success = FALSE) as failed_calls
FROM apollo_api_log
GROUP BY DATE(created_at), organization_id, api_endpoint
ORDER BY date DESC, total_cost DESC;

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON TABLE enrichment_queue IS 'Queue system for async contact enrichment processing';
COMMENT ON TABLE apollo_api_log IS 'Detailed log of all Apollo.io API calls for cost tracking and debugging';
COMMENT ON VIEW enrichment_queue_detailed IS 'Enrichment queue with full business and organization context';
COMMENT ON VIEW apollo_api_usage_summary IS 'Daily summary of Apollo API usage by organization and endpoint';

COMMENT ON COLUMN contact_enrichments.reveal_method IS 'How contact was enriched: claude_only (website only), enrich_only (Claude found name, Apollo enriched), search_then_enrich (full Apollo workflow)';
COMMENT ON COLUMN enrichment_queue.target_executive_count IS 'How many executives to find per business (default: 1 for cost optimization)';
COMMENT ON COLUMN apollo_api_log.api_endpoint IS 'Apollo API endpoint used: search, enrich, or bulk_enrich';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 003 completed successfully!';
    RAISE NOTICE 'Created tables: enrichment_queue, apollo_api_log';
    RAISE NOTICE 'Extended table: contact_enrichments (Apollo fields)';
    RAISE NOTICE 'Created views: enrichment_queue_detailed, apollo_api_usage_summary';
    RAISE NOTICE 'Created functions: get_enrichment_stats(), get_next_enrichment_job()';
END $$;
