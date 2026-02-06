import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'

// Load environment variables
dotenv.config({ path: '.env.local' })

// Get __dirname equivalent in ES modules
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
    console.log('🔄 Connecting to database...')

    // Read migration file
    const migrationPath = path.join(
      __dirname,
      '../database/migrations/009_add_contact_fields.sql'
    )
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    console.log('📝 Running migration 009_add_contact_fields.sql...')

    // Execute migration
    await pool.query(migrationSQL)

    console.log('✅ Migration 009 completed successfully!')
    console.log('\n📋 Summary:')
    console.log('   - Added contact fields: first_name, last_name, email')
    console.log('   - Added business fields: category, google_profile_url, negative_review_url')
    console.log('   - Added import tracking: import_status, import_notes')
    console.log('   - Updated get_leads_for_va() function with new fields')
    console.log('   - Added indexes for search optimization')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

runMigration()
