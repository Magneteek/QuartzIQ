import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

/**
 * POST /api/migrations/020
 * Run migration 020: Review Tracking and Export Status
 */
export async function POST() {
  try {
    console.log('🔄 Running migration 020: Review Tracking and Export Status...')

    const sql = `
      -- Migration 020: Review Tracking and Export Status

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
    `

    await pool.query(sql)

    console.log('✅ Migration 020 completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Migration 020 completed successfully',
      changes: [
        'Added last_qualified_review_date column',
        'Added qualified_reviews_count column',
        'Added last_review_check_date column',
        'Added exported_to_ghl column',
        'Added exported_to_ghl_at column',
        'Added ghl_contact_id column',
        'Created indexes for performance',
        'Updated existing businesses'
      ]
    })

  } catch (error: any) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json(
      { error: error.message || 'Migration failed' },
      { status: 500 }
    )
  }
}
