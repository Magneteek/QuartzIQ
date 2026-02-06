/**
 * Run Migration 016: Add Missing Alert Columns
 */

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
    console.log('🚀 Running migration 016: Add missing alert columns...')

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/016_add_missing_alert_columns.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Execute migration
    await pool.query(migrationSQL)

    console.log('✅ Migration 016 completed successfully!')
    console.log('   - Added reviewer_name column')
    console.log('   - Added resolved_by column')
    console.log('   - Created index on resolved_by')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

runMigration()
