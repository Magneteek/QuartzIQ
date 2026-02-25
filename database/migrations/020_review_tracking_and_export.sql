-- Migration 020: Review Tracking and Export Status
-- Adds proper tracking for qualifying reviews and CRM exports

-- Add review tracking columns
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS last_qualified_review_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS qualified_reviews_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_review_check_date TIMESTAMP;

-- Add export tracking columns
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS exported_to_ghl BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS exported_to_ghl_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS ghl_contact_id VARCHAR(255);

-- Add index for sorting by most recent qualifying review
CREATE INDEX IF NOT EXISTS idx_businesses_last_qualified_review
ON businesses(last_qualified_review_date DESC NULLS LAST);

-- Add index for filtering exported businesses
CREATE INDEX IF NOT EXISTS idx_businesses_exported_to_ghl
ON businesses(exported_to_ghl) WHERE exported_to_ghl = FALSE;

-- Update existing businesses with review data
UPDATE businesses
SET last_qualified_review_date = first_discovered_at
WHERE last_qualified_review_date IS NULL
  AND lifecycle_stage IN ('lead', 'qualified');

-- Add comment
COMMENT ON COLUMN businesses.last_qualified_review_date IS 'Date when the most recent qualifying review was found';
COMMENT ON COLUMN businesses.qualified_reviews_count IS 'Total count of qualifying reviews found for this business';
COMMENT ON COLUMN businesses.last_review_check_date IS 'Last time we checked for new reviews';
COMMENT ON COLUMN businesses.exported_to_ghl IS 'Whether this business has been exported to GoHighLevel CRM';
COMMENT ON COLUMN businesses.exported_to_ghl_at IS 'Timestamp when exported to GoHighLevel';
COMMENT ON COLUMN businesses.ghl_contact_id IS 'Contact ID in GoHighLevel CRM';
