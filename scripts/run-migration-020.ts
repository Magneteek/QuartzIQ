/**
 * Run Migration 020: Improve Alert Status Tracking
 */

import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

async function runMigration() {
  try {
    console.log('🚀 Running Migration 020: Improve Alert Status Tracking')

    // Read migration file
    const migrationSQL = readFileSync(
      join(__dirname, '../database/migrations/020_improve_alert_status_tracking.sql'),
      'utf-8'
    )

    // Execute migration
    await pool.query(migrationSQL)

    console.log('✅ Migration 020 completed successfully')

    // Verify the changes
    const alertsCheck = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count
      FROM customer_monitoring_alerts
    `)

    console.log('\n📊 Alert Status Summary:')
    console.log(`Total alerts: ${alertsCheck.rows[0].total}`)
    console.log(`New: ${alertsCheck.rows[0].new_count}`)
    console.log(`In Progress: ${alertsCheck.rows[0].in_progress_count}`)
    console.log(`Resolved: ${alertsCheck.rows[0].resolved_count}`)

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

runMigration()
