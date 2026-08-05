-- ============================================================
-- Migration 026: Roast Reports
-- Purpose: The sendable, trackable report built from a completed
-- website_audits row. Deliberately separate from website_audits:
-- report_data is a FROZEN SNAPSHOT taken at generation time, not a
-- live join, so a report already sent to a prospect never silently
-- changes if the underlying audit is re-run later.
-- ============================================================

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    website_audit_id UUID REFERENCES website_audits(id), -- lineage only, not live-rendered from

    slug VARCHAR(255) UNIQUE NOT NULL,  -- personalized report URL
    report_data JSONB NOT NULL,         -- snapshot of everything needed to render the page

    status VARCHAR(20) DEFAULT 'draft', -- draft, sent, viewed
    sent_at TIMESTAMP,
    first_viewed_at TIMESTAMP,
    last_viewed_at TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    cta_clicked_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_slug ON reports(slug);
CREATE INDEX IF NOT EXISTS idx_reports_business ON reports(business_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
