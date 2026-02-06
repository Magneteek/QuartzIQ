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
    console.log('🔄 Running Migration 017: Add URL to reviews table...\n')

    const migrationPath = path.join(process.cwd(), 'database/migrations/017_add_url_to_reviews.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    await pool.query(migrationSQL)

    console.log('✅ Migration 017 completed successfully!\n')
    console.log('Added columns:')
    console.log('  - url (text) - Direct URL to the review')
    console.log('')

    await pool.end()
  } catch (error) {
    console.error('❌ Migration failed:', error)
    await pool.end()
    throw error
  }
}

runMigration()
