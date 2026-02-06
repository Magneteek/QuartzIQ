-- Migration 020: Improve Alert Status Tracking
-- Simplifies alert management with clear statuses and webhook tracking

-- 1. Add new status column (simplified workflow)
ALTER TABLE customer_monitoring_alerts
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'new'
  CHECK (status IN ('new', 'in_progress', 'resolved', 'dismissed'));

-- 2. Add GHL webhook tracking
ALTER TABLE customer_monitoring_alerts
ADD COLUMN IF NOT EXISTS ghl_webhook_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ghl_webhook_sent_at TIMESTAMP;

-- 3. Migrate existing data to new status field
-- If acknowledged but not resolved = in_progress
-- If resolved = resolved
-- Otherwise = new
UPDATE customer_monitoring_alerts
SET status = CASE
  WHEN resolved_at IS NOT NULL THEN 'resolved'
  WHEN acknowledged_at IS NOT NULL THEN 'in_progress'
  ELSE 'new'
END
WHERE status = 'new'; -- Only update if not already set

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_status ON customer_monitoring_alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_webhook_sent ON customer_monitoring_alerts(ghl_webhook_sent);

-- 5. Add comments
COMMENT ON COLUMN customer_monitoring_alerts.status IS 'Alert workflow status: new → in_progress → resolved (or dismissed)';
COMMENT ON COLUMN customer_monitoring_alerts.ghl_webhook_sent IS 'Whether alert was sent to GoHighLevel webhook for customer notification';
COMMENT ON COLUMN customer_monitoring_alerts.ghl_webhook_sent_at IS 'When the alert webhook was sent to GHL';

-- 6. Create helper function to get unresolved alerts count
CREATE OR REPLACE FUNCTION get_unresolved_alerts_count(customer_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM customer_monitoring_alerts
  WHERE business_id = customer_id
    AND status IN ('new', 'in_progress')
$$ LANGUAGE SQL STABLE;

SELECT 'Migration 020 completed: Alert status tracking improved' AS status;
