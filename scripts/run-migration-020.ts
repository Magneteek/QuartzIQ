import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

async function runMigration() {
  try {
    console.log('🔄 Running migration 020: Review Tracking and Export Status...')

    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '020_review_tracking_and_export.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    await pool.query(sql)

    console.log('✅ Migration 020 completed successfully!')
    console.log('   - Added last_qualified_review_date column')
    console.log('   - Added qualified_reviews_count column')
    console.log('   - Added last_review_check_date column')
    console.log('   - Added exported_to_ghl column')
    console.log('   - Added exported_to_ghl_at column')
    console.log('   - Added ghl_contact_id column')
    console.log('   - Created indexes for performance')

    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

runMigration()
