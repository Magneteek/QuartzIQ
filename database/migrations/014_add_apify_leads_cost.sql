/**
 * Migration 014: Add Apify Leads Cost Tracking
 *
 * Adds apify_leads_cost column to contact_enrichments table
 * to track costs for Apify's business leads enrichment add-on.
 *
 * Cost: $0.005 per lead found
 */

-- Add apify_leads_cost column to contact_enrichments table
ALTER TABLE contact_enrichments
ADD COLUMN IF NOT EXISTS apify_leads_cost DECIMAL(10, 4) DEFAULT 0.00;

-- Add comment for documentation
COMMENT ON COLUMN contact_enrichments.apify_leads_cost IS 'Cost for Apify leads enrichment ($0.005 per lead)';

-- Update reveal_method to allow 'apify_only' value
-- First, check if reveal_method is an enum or text with constraint
DO $$
DECLARE
    column_type TEXT;
    has_enum BOOLEAN;
BEGIN
    -- Get the column type
    SELECT data_type INTO column_type
    FROM information_schema.columns
    WHERE table_name = 'contact_enrichments'
    AND column_name = 'reveal_method';

    -- Check if reveal_method_enum exists
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'reveal_method_enum'
    ) INTO has_enum;

    IF has_enum THEN
        -- Enum exists, check if apify_only value already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'apify_only'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'reveal_method_enum')
        ) THEN
            -- Add the new enum value
            ALTER TYPE reveal_method_enum ADD VALUE 'apify_only';
            RAISE NOTICE 'Added apify_only to reveal_method_enum';
        END IF;
    ELSE
        -- No enum, likely using CHECK constraint - update it
        -- Drop existing constraint if it exists
        ALTER TABLE contact_enrichments
        DROP CONSTRAINT IF EXISTS contact_enrichments_reveal_method_check;

        -- Add new constraint with apify_only included
        ALTER TABLE contact_enrichments
        ADD CONSTRAINT contact_enrichments_reveal_method_check
        CHECK (reveal_method IN ('claude_only', 'apify_only', 'enrich_only', 'search_then_enrich'));

        RAISE NOTICE 'Updated reveal_method CHECK constraint to include apify_only';
    END IF;
END$$;

-- Create index for cost analysis queries
CREATE INDEX IF NOT EXISTS idx_contact_enrichments_apify_cost
ON contact_enrichments(apify_leads_cost)
WHERE apify_leads_cost > 0;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 014 complete: Added apify_leads_cost tracking';
END$$;
