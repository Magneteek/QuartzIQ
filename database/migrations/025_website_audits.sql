-- ============================================================
-- Migration 025: Website Audits
-- Purpose: Stage 3 (staleness enrichment) + Stage 4 (deep audit) data
-- for the "roast" pipeline. One row per audit run per business, so a
-- business can be re-audited over time without losing history.
-- Follows the same business_id-keyed pattern as contact_enrichments.
-- ============================================================

CREATE TABLE IF NOT EXISTS website_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

    -- Stage 3: staleness enrichment (WHOIS + tech stack)
    domain_registered_at DATE,
    domain_age_days INTEGER,
    tech_stack JSONB,               -- CMS, SSL presence, framework signals
    is_stale BOOLEAN,

    -- Stage 4: deep audit (Lighthouse + screenshot + links + form test)
    lighthouse_performance INTEGER,
    lighthouse_seo INTEGER,
    lighthouse_accessibility INTEGER,
    screenshot_url TEXT,
    broken_links_count INTEGER,
    broken_links JSONB,
    form_test_result VARCHAR(20),   -- pass, fail, no_form_found, not_tested
    form_test_notes TEXT,

    -- Composite scoring (drives the report's headline numbers)
    health_score INTEGER,           -- 0-100
    estimated_search_volume INTEGER,
    assumed_conversion_rate DECIMAL(4, 3),
    estimated_monthly_leads_lost INTEGER,

    audit_status VARCHAR(20) DEFAULT 'pending', -- pending, staleness_checked, completed, failed
    audited_at TIMESTAMP,
    error_message TEXT,

    raw_data JSONB DEFAULT '{}',    -- full raw API responses, same caching pattern as businesses.raw_data
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_audits_business ON website_audits(business_id);
CREATE INDEX IF NOT EXISTS idx_website_audits_status ON website_audits(audit_status);
CREATE INDEX IF NOT EXISTS idx_website_audits_is_stale ON website_audits(is_stale);
