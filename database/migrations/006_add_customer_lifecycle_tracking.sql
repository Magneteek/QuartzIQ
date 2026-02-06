-- Migration 006: Customer Lifecycle Tracking & Monitoring
-- Purpose: Track paying customers and automatically monitor them for new negative reviews

-- 1. Add customer lifecycle fields to businesses table
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(50) DEFAULT 'prospect',
ADD COLUMN IF NOT EXISTS lifecycle_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_paying_customer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS customer_since DATE,
ADD COLUMN IF NOT EXISTS customer_tier VARCHAR(50), -- 'basic', 'premium', 'enterprise'
ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS monitoring_frequency_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS last_monitoring_check TIMESTAMP,
ADD COLUMN IF NOT EXISTS next_monitoring_check TIMESTAMP,
ADD COLUMN IF NOT EXISTS monitoring_alert_threshold INTEGER DEFAULT 3, -- Alert if stars <= this value
ADD COLUMN IF NOT EXISTS total_removed_reviews INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Create indexes for customer queries
CREATE INDEX IF NOT EXISTS idx_businesses_lifecycle_stage ON businesses(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_businesses_is_paying_customer ON businesses(is_paying_customer);
CREATE INDEX IF NOT EXISTS idx_businesses_monitoring_enabled ON businesses(monitoring_enabled);
CREATE INDEX IF NOT EXISTS idx_businesses_next_monitoring_check ON businesses(next_monitoring_check);

-- 3. Add users table first (needed for foreign keys)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- 4. Create customer_monitoring_alerts table
CREATE TABLE IF NOT EXISTS customer_monitoring_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- 'new_negative_review', 'rating_drop', 'review_spike'
  severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'

  -- Alert details
  review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,
  review_stars INTEGER,
  review_text TEXT,
  review_date TIMESTAMP,

  -- Alert metadata
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  resolution_notes TEXT,

  -- Actions taken
  action_taken VARCHAR(100), -- 'removal_requested', 'customer_notified', 'ignored'
  action_date TIMESTAMP,

  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_alert_type CHECK (alert_type IN ('new_negative_review', 'rating_drop', 'review_spike'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_business ON customer_monitoring_alerts(business_id);
CREATE INDEX IF NOT EXISTS idx_alerts_detected ON customer_monitoring_alerts(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unacknowledged ON customer_monitoring_alerts(acknowledged_at) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON customer_monitoring_alerts(severity);

-- 5. Create customer_monitoring_history table (track all checks)
CREATE TABLE IF NOT EXISTS customer_monitoring_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviews_found INTEGER DEFAULT 0,
  new_reviews_count INTEGER DEFAULT 0,
  negative_reviews_found INTEGER DEFAULT 0,
  alerts_created INTEGER DEFAULT 0,
  scrape_cost_usd DECIMAL(10, 4) DEFAULT 0,
  scrape_duration_ms INTEGER,
  status VARCHAR(50) DEFAULT 'success', -- 'success', 'failed', 'skipped'
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_monitoring_history_business ON customer_monitoring_history(business_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_history_checked ON customer_monitoring_history(checked_at DESC);

-- 6. Create helper function to get customers needing monitoring
CREATE OR REPLACE FUNCTION get_customers_for_monitoring(check_time TIMESTAMP DEFAULT NOW())
RETURNS TABLE (
  business_id UUID,
  business_name VARCHAR,
  place_id VARCHAR,
  last_checked TIMESTAMP,
  frequency_hours INTEGER,
  lifecycle_stage VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.place_id,
    b.last_monitoring_check,
    b.monitoring_frequency_hours,
    b.lifecycle_stage
  FROM businesses b
  WHERE b.monitoring_enabled = TRUE
    AND b.is_paying_customer = TRUE
    AND (
      b.next_monitoring_check IS NULL
      OR b.next_monitoring_check <= check_time
    )
  ORDER BY b.next_monitoring_check ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql;

-- 7. Create helper function to update lifecycle stage
CREATE OR REPLACE FUNCTION update_customer_lifecycle(
  p_business_id UUID,
  p_new_stage VARCHAR,
  p_is_paying BOOLEAN DEFAULT NULL,
  p_customer_tier VARCHAR DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE businesses
  SET
    lifecycle_stage = p_new_stage,
    lifecycle_updated_at = CURRENT_TIMESTAMP,
    is_paying_customer = COALESCE(p_is_paying, is_paying_customer),
    customer_tier = COALESCE(p_customer_tier, customer_tier),
    customer_since = CASE
      WHEN p_is_paying = TRUE AND customer_since IS NULL THEN CURRENT_DATE
      ELSE customer_since
    END
  WHERE id = p_business_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Create helper function to schedule next monitoring check
CREATE OR REPLACE FUNCTION schedule_next_monitoring_check(
  p_business_id UUID,
  p_frequency_hours INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_frequency INTEGER;
BEGIN
  -- Use provided frequency or existing frequency
  SELECT COALESCE(p_frequency_hours, monitoring_frequency_hours, 24)
  INTO v_frequency
  FROM businesses
  WHERE id = p_business_id;

  UPDATE businesses
  SET
    last_monitoring_check = CURRENT_TIMESTAMP,
    next_monitoring_check = CURRENT_TIMESTAMP + (v_frequency || ' hours')::INTERVAL
  WHERE id = p_business_id;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to get customer monitoring stats
CREATE OR REPLACE FUNCTION get_customer_monitoring_stats()
RETURNS TABLE (
  total_customers INTEGER,
  monitored_customers INTEGER,
  pending_checks INTEGER,
  total_alerts_today INTEGER,
  unacknowledged_alerts INTEGER,
  total_checks_today INTEGER,
  avg_scrape_cost_usd DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM businesses WHERE is_paying_customer = TRUE)::INTEGER,
    (SELECT COUNT(*) FROM businesses WHERE monitoring_enabled = TRUE)::INTEGER,
    (SELECT COUNT(*) FROM businesses WHERE monitoring_enabled = TRUE AND next_monitoring_check <= NOW())::INTEGER,
    (SELECT COUNT(*) FROM customer_monitoring_alerts WHERE detected_at >= CURRENT_DATE)::INTEGER,
    (SELECT COUNT(*) FROM customer_monitoring_alerts WHERE acknowledged_at IS NULL)::INTEGER,
    (SELECT COUNT(*) FROM customer_monitoring_history WHERE checked_at >= CURRENT_DATE)::INTEGER,
    (SELECT COALESCE(AVG(scrape_cost_usd), 0) FROM customer_monitoring_history WHERE checked_at >= CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- 10. Add lifecycle stage constraint
ALTER TABLE businesses
DROP CONSTRAINT IF EXISTS valid_lifecycle_stage;

ALTER TABLE businesses
ADD CONSTRAINT valid_lifecycle_stage CHECK (
  lifecycle_stage IN ('prospect', 'lead', 'qualified', 'customer', 'churned')
);

-- 11. Add comments for documentation
COMMENT ON COLUMN businesses.lifecycle_stage IS 'Customer lifecycle: prospect → lead → qualified → customer → churned';
COMMENT ON COLUMN businesses.monitoring_enabled IS 'Enable automatic monitoring for new negative reviews';
COMMENT ON COLUMN businesses.monitoring_frequency_hours IS 'How often to check this customer (in hours)';
COMMENT ON TABLE customer_monitoring_alerts IS 'Alerts for new negative reviews detected on paying customers';
COMMENT ON TABLE customer_monitoring_history IS 'History of all monitoring checks performed';
