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
      '../database/migrations/008_stage1_lead_qualification.sql'
    )
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    console.log('📝 Running migration 008_stage1_lead_qualification.sql...')

    // Execute migration
    await pool.query(migrationSQL)

    console.log('✅ Migration 008 completed successfully!')
    console.log('\n📋 Summary:')
    console.log('   - Added VA-specific fields to businesses table')
    console.log('   - Added enrichment tracking fields')
    console.log('   - Created lead_activity_log table')
    console.log('   - Added indexes for lead queries')
    console.log('   - Created helper functions:')
    console.log('     • get_leads_for_va() - Fetch leads with pagination/search')
    console.log('     • get_lead_stats() - Get lead statistics')
    console.log('     • log_lead_activity() - Log lead changes')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

runMigration()
