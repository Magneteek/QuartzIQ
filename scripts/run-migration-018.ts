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
    console.log('🔄 Running Migration 018: Sync google_profile_url to google_maps_url...\n')

    // Check how many businesses will be affected
    const checkResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM businesses
      WHERE google_profile_url IS NOT NULL
        AND google_maps_url IS NULL
    `)

    const affectedCount = parseInt(checkResult.rows[0].count)
    console.log(`   Found ${affectedCount} businesses that need URL syncing`)

    if (affectedCount === 0) {
      console.log('✅ No businesses need updating!\n')
      await pool.end()
      return
    }

    const migrationPath = path.join(process.cwd(), 'database/migrations/018_sync_google_urls.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    await pool.query(migrationSQL)

    console.log(`✅ Migration 018 completed successfully!`)
    console.log(`   Updated ${affectedCount} businesses`)
    console.log('')

    await pool.end()
  } catch (error) {
    console.error('❌ Migration failed:', error)
    await pool.end()
    throw error
  }
}

runMigration()
