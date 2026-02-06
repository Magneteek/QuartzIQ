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
    console.log('🔄 Running migration 012: Fix get_lead_stats function...')

    const migrationPath = path.join(
      __dirname,
      '../database/migrations/012_fix_get_lead_stats.sql'
    )

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    await pool.query(migrationSQL)

    console.log('✅ Migration 012 completed successfully!')
    console.log('   - Fixed get_lead_stats() function:')
    console.log('     • Added table alias "b" to all column references')
    console.log('     • Changed created_at to first_discovered_at')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

runMigration()
