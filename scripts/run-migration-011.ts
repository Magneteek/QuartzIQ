import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'

// Load environment variables
dotenv.config({ path: '.env.local' })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runMigration() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  })

  try {
    console.log('🔄 Running migration 011: Fix get_leads_for_va column names...')

    const migrationPath = path.join(
      __dirname,
      '../database/migrations/011_fix_get_leads_for_va_columns.sql'
    )

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    await pool.query(migrationSQL)

    console.log('✅ Migration 011 completed successfully!')
    console.log('   - Fixed get_leads_for_va() function to use correct column names:')
    console.log('     • name → business_name')
    console.log('     • reviews_count → total_reviews')
    console.log('     • country_code → country')
    console.log('     • published_date → review_date')
    console.log('     • first_discovered_at → created_at')
    console.log('     • last_updated_at → updated_at')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

runMigration()
