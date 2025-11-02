-- ============================================================
-- QUARTZIQ MULTI-TENANT SAAS DATABASE SCHEMA
-- Review Extraction & Monitoring System
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============================================================
-- MULTI-TENANT CORE TABLES
-- ============================================================

-- Organizations (Tenants) - Your paying clients
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'starter', -- starter, growth, business, enterprise
    subscription_status VARCHAR(50) DEFAULT 'active', -- active, suspended, cancelled
    monthly_extraction_limit INTEGER DEFAULT 500,
    monthly_extractions_used INTEGER DEFAULT 0,
    api_key VARCHAR(255) UNIQUE, -- For API access
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_reset_at TIMESTAMP DEFAULT NOW() -- For monthly limit reset
);

-- Create index for fast lookups
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_api_key ON organizations(api_key);

-- Users (Multi-tenant users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member', -- admin, member, viewer
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- SHARED BUSINESS CACHE (Cross-tenant optimization)
-- ============================================================

-- Global business registry (shared across all tenants to reduce API costs)
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id VARCHAR(255) UNIQUE NOT NULL, -- Google Maps placeId

    -- Business Identity
    name VARCHAR(500) NOT NULL,
    category VARCHAR(255),

    -- Location
    address VARCHAR(500),
    city VARCHAR(255),
    postal_code VARCHAR(50),
    state VARCHAR(255),
    country_code CHAR(2),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Contact Information
    phone VARCHAR(50),
    website VARCHAR(500),
    email VARCHAR(255),

    -- Reputation Metrics
    rating DECIMAL(2, 1), -- Current Google rating
    reviews_count INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, closed, temporarily_closed
    permanently_closed BOOLEAN DEFAULT FALSE,

    -- Google Maps Data
    google_maps_url TEXT,

    -- Deduplication fingerprint
    fingerprint VARCHAR(255) UNIQUE, -- name_normalized + address_normalized hash

    -- Metadata
    first_discovered_at TIMESTAMP DEFAULT NOW(),
    last_updated_at TIMESTAMP DEFAULT NOW(),
    last_scraped_at TIMESTAMP,
    scrape_count INTEGER DEFAULT 0,

    -- Full data cache (reduce API calls)
    raw_data JSONB DEFAULT '{}'
);

-- Indexes for fast lookups and deduplication
CREATE INDEX idx_businesses_place_id ON businesses(place_id);
CREATE INDEX idx_businesses_fingerprint ON businesses(fingerprint);
CREATE INDEX idx_businesses_location ON businesses(city, country_code);
CREATE INDEX idx_businesses_category ON businesses(category);
CREATE INDEX idx_businesses_rating ON businesses(rating);
CREATE INDEX idx_businesses_last_scraped ON businesses(last_scraped_at);
CREATE INDEX idx_businesses_name_trgm ON businesses USING gin(name gin_trgm_ops); -- Fuzzy search

-- ============================================================
-- REVIEWS CACHE (Incremental updates)
-- ============================================================

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,

    -- Review Identity
    review_id VARCHAR(255), -- Apify/Google review ID

    -- Review Content
    reviewer_name VARCHAR(255),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    text TEXT,

    -- Timestamps
    published_date DATE NOT NULL,
    extracted_at TIMESTAMP DEFAULT NOW(),

    -- Sentiment Analysis
    sentiment_score DECIMAL(3, 2), -- -1.0 to 1.0
    sentiment_label VARCHAR(50), -- positive, neutral, negative

    -- Advanced Analysis (GPT-4)
    complaint_category VARCHAR(100), -- service, staff, pricing, cleanliness, etc.
    severity_score INTEGER, -- 1-10
    urgency_level VARCHAR(50), -- low, medium, high, critical
    ai_insights JSONB DEFAULT '{}',

    -- Metadata
    source VARCHAR(50) DEFAULT 'apify', -- apify, manual, api
    language VARCHAR(10) DEFAULT 'nl',

    -- Deduplication
    review_hash VARCHAR(255), -- Hash of reviewer_name + text + date

    -- Response tracking
    owner_response TEXT,
    owner_response_date DATE,

    raw_data JSONB DEFAULT '{}'
);

-- Indexes for fast queries
CREATE INDEX idx_reviews_business ON reviews(business_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_published_date ON reviews(published_date);
CREATE INDEX idx_reviews_extracted_at ON reviews(extracted_at);
CREATE INDEX idx_reviews_sentiment ON reviews(sentiment_label);
CREATE INDEX idx_reviews_category ON reviews(complaint_category);
CREATE INDEX idx_reviews_hash ON reviews(review_hash); -- Deduplication
CREATE UNIQUE INDEX idx_reviews_unique ON reviews(business_id, review_hash); -- Prevent duplicates

-- ============================================================
-- TENANT-SPECIFIC MONITORING & EXTRACTIONS
-- ============================================================

-- Monitoring configurations per tenant
CREATE TABLE monitoring_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Search Criteria
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    location VARCHAR(255),
    country_code CHAR(2) DEFAULT 'nl',

    -- Filters
    max_business_rating DECIMAL(2, 1) DEFAULT 4.6,
    max_review_stars INTEGER DEFAULT 3,
    day_limit INTEGER DEFAULT 14,
    business_limit INTEGER DEFAULT 50,

    -- Schedule
    schedule_enabled BOOLEAN DEFAULT FALSE,
    schedule_frequency VARCHAR(50), -- daily, weekly, monthly
    schedule_time TIME,
    schedule_days VARCHAR(100), -- JSON array of days for weekly

    -- Alerts
    alerts_enabled BOOLEAN DEFAULT TRUE,
    alert_channels JSONB DEFAULT '[]', -- email, webhook, slack

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_monitoring_org ON monitoring_configs(organization_id);
CREATE INDEX idx_monitoring_schedule ON monitoring_configs(schedule_enabled, next_run_at);

-- Extraction history per tenant (links to shared business cache)
CREATE TABLE extractions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    monitoring_config_id UUID REFERENCES monitoring_configs(id) ON DELETE SET NULL,

    -- Extraction metadata
    extraction_type VARCHAR(50) DEFAULT 'manual', -- manual, scheduled, api

    -- Search criteria used
    search_criteria JSONB NOT NULL,

    -- Results summary
    businesses_found INTEGER DEFAULT 0,
    reviews_extracted INTEGER DEFAULT 0,
    new_businesses INTEGER DEFAULT 0, -- Businesses not in cache
    cached_businesses INTEGER DEFAULT 0, -- Businesses from cache
    new_reviews INTEGER DEFAULT 0, -- Reviews not in cache

    -- Cost tracking
    apify_credits_used DECIMAL(10, 4) DEFAULT 0,
    apify_cost_usd DECIMAL(10, 2) DEFAULT 0,

    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_extractions_org ON extractions(organization_id);
CREATE INDEX idx_extractions_config ON extractions(monitoring_config_id);
CREATE INDEX idx_extractions_status ON extractions(status);
CREATE INDEX idx_extractions_created ON extractions(created_at);

-- Link extractions to businesses (many-to-many)
CREATE TABLE extraction_businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extraction_id UUID REFERENCES extractions(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Was this business in cache or newly discovered?
    was_cached BOOLEAN DEFAULT FALSE,

    -- Reviews for this business in this extraction
    reviews_found INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(extraction_id, business_id)
);

CREATE INDEX idx_extraction_businesses_extraction ON extraction_businesses(extraction_id);
CREATE INDEX idx_extraction_businesses_business ON extraction_businesses(business_id);
CREATE INDEX idx_extraction_businesses_org ON extraction_businesses(organization_id);

-- Link extractions to reviews (many-to-many)
CREATE TABLE extraction_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extraction_id UUID REFERENCES extractions(id) ON DELETE CASCADE,
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Was this review in cache or newly extracted?
    was_cached BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(extraction_id, review_id)
);

CREATE INDEX idx_extraction_reviews_extraction ON extraction_reviews(extraction_id);
CREATE INDEX idx_extraction_reviews_review ON extraction_reviews(review_id);
CREATE INDEX idx_extraction_reviews_org ON extraction_reviews(organization_id);

-- ============================================================
-- CONTACT ENRICHMENT TRACKING
-- ============================================================

CREATE TABLE contact_enrichments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Contact data
    email VARCHAR(255),
    phone VARCHAR(50),
    linkedin_url VARCHAR(500),
    owner_name VARCHAR(255),
    owner_linkedin VARCHAR(500),

    -- Enrichment metadata
    enrichment_source VARCHAR(100), -- firecrawl, hunter, apollo, manual
    confidence_score DECIMAL(3, 2), -- 0.0 to 1.0
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,

    -- Cost tracking
    enrichment_cost_usd DECIMAL(10, 4) DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contact_enrichments_business ON contact_enrichments(business_id);
CREATE INDEX idx_contact_enrichments_org ON contact_enrichments(organization_id);

-- ============================================================
-- COST TRACKING & ANALYTICS
-- ============================================================

CREATE TABLE api_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    extraction_id UUID REFERENCES extractions(id) ON DELETE SET NULL,

    -- API tracking
    api_service VARCHAR(50) NOT NULL, -- apify, firecrawl, hunter, apollo, etc.
    api_action VARCHAR(100), -- maps_search, review_extract, contact_enrich, etc.

    -- Cost
    credits_used DECIMAL(10, 4) DEFAULT 0,
    cost_usd DECIMAL(10, 4) DEFAULT 0,

    -- Metadata
    request_metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_usage_org ON api_usage_log(organization_id);
CREATE INDEX idx_api_usage_service ON api_usage_log(api_service);
CREATE INDEX idx_api_usage_created ON api_usage_log(created_at);

-- ============================================================
-- SUBSCRIPTION & BILLING
-- ============================================================

CREATE TABLE subscription_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Subscription details
    tier VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,

    -- Billing
    monthly_price DECIMAL(10, 2),
    currency CHAR(3) DEFAULT 'USD',

    -- Stripe integration
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),

    -- Period
    period_start DATE NOT NULL,
    period_end DATE,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscription_org ON subscription_history(organization_id);
CREATE INDEX idx_subscription_stripe ON subscription_history(stripe_subscription_id);

-- ============================================================
-- BUSINESS DEDUPLICATION FUNCTIONS
-- ============================================================

-- Function to generate business fingerprint
CREATE OR REPLACE FUNCTION generate_business_fingerprint(
    p_name VARCHAR,
    p_address VARCHAR,
    p_phone VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
    normalized_name VARCHAR;
    normalized_address VARCHAR;
    normalized_phone VARCHAR;
BEGIN
    -- Normalize name: lowercase, remove special chars, trim whitespace
    normalized_name := LOWER(REGEXP_REPLACE(TRIM(p_name), '[^a-z0-9\s]', '', 'g'));
    normalized_name := REGEXP_REPLACE(normalized_name, '\s+', ' ', 'g');

    -- Normalize address
    normalized_address := LOWER(REGEXP_REPLACE(TRIM(COALESCE(p_address, '')), '[^a-z0-9\s]', '', 'g'));

    -- Normalize phone
    normalized_phone := REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');

    -- Generate MD5 hash of concatenated normalized fields
    RETURN MD5(normalized_name || '|' || normalized_address || '|' || normalized_phone);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find duplicate businesses
CREATE OR REPLACE FUNCTION find_duplicate_business(
    p_place_id VARCHAR,
    p_name VARCHAR,
    p_address VARCHAR,
    p_phone VARCHAR
) RETURNS UUID AS $$
DECLARE
    v_fingerprint VARCHAR;
    v_business_id UUID;
BEGIN
    -- First check by place_id (fastest)
    IF p_place_id IS NOT NULL THEN
        SELECT id INTO v_business_id
        FROM businesses
        WHERE place_id = p_place_id;

        IF v_business_id IS NOT NULL THEN
            RETURN v_business_id;
        END IF;
    END IF;

    -- Then check by fingerprint
    v_fingerprint := generate_business_fingerprint(p_name, p_address, p_phone);

    SELECT id INTO v_business_id
    FROM businesses
    WHERE fingerprint = v_fingerprint;

    RETURN v_business_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monitoring_configs_updated_at BEFORE UPDATE ON monitoring_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate fingerprint on business insert/update
CREATE OR REPLACE FUNCTION auto_generate_fingerprint()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fingerprint := generate_business_fingerprint(NEW.name, NEW.address, NEW.phone);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_business_fingerprint BEFORE INSERT OR UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION auto_generate_fingerprint();

-- ============================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================

-- Insert sample organization
INSERT INTO organizations (name, slug, subscription_tier, monthly_extraction_limit, api_key)
VALUES
    ('Test Client 1', 'test-client-1', 'growth', 2000, 'test_api_key_abc123'),
    ('Test Client 2', 'test-client-2', 'starter', 500, 'test_api_key_xyz789');

-- ============================================================
-- USEFUL QUERIES FOR OPTIMIZATION
-- ============================================================

-- Find businesses that haven't been scraped in X days (candidates for update)
-- SELECT * FROM businesses WHERE last_scraped_at < NOW() - INTERVAL '7 days';

-- Count reviews per business in last 30 days
-- SELECT b.name, COUNT(r.id) as review_count
-- FROM businesses b
-- LEFT JOIN reviews r ON r.business_id = b.id AND r.published_date >= CURRENT_DATE - 30
-- GROUP BY b.id, b.name
-- ORDER BY review_count DESC;

-- Organization usage summary
-- SELECT
--     o.name,
--     o.monthly_extraction_limit,
--     o.monthly_extractions_used,
--     COUNT(e.id) as total_extractions,
--     SUM(e.apify_cost_usd) as total_cost
-- FROM organizations o
-- LEFT JOIN extractions e ON e.organization_id = o.id
-- GROUP BY o.id, o.name, o.monthly_extraction_limit, o.monthly_extractions_used;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Composite indexes for common queries
CREATE INDEX idx_reviews_business_date ON reviews(business_id, published_date DESC);
CREATE INDEX idx_reviews_business_rating ON reviews(business_id, rating);
CREATE INDEX idx_businesses_location_rating ON businesses(city, country_code, rating);
CREATE INDEX idx_extractions_org_created ON extractions(organization_id, created_at DESC);
