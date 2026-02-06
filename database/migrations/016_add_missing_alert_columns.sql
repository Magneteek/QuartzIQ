-- Migration 016: Add Missing Columns to Customer Monitoring Alerts
-- Purpose: Add reviewer_name and resolved_by columns that API expects

-- Add reviewer_name column (to store name of reviewer who left the review)
ALTER TABLE customer_monitoring_alerts
ADD COLUMN IF NOT EXISTS reviewer_name VARCHAR(255);

-- Add resolved_by column (to track who resolved the alert)
ALTER TABLE customer_monitoring_alerts
ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for resolved_by lookups
CREATE INDEX IF NOT EXISTS idx_alerts_resolved_by ON customer_monitoring_alerts(resolved_by);

-- Add comment
COMMENT ON COLUMN customer_monitoring_alerts.reviewer_name IS 'Name of the person who left the review';
COMMENT ON COLUMN customer_monitoring_alerts.resolved_by IS 'User ID who resolved this alert';
