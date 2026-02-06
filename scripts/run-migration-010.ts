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
    console.log('🔄 Running migration 010: Add va_notes to get_leads_for_va function...')

    const migrationPath = path.join(
      __dirname,
      '../database/migrations/010_add_va_notes_to_function.sql'
    )

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    await pool.query(migrationSQL)

    console.log('✅ Migration 010 completed successfully!')
    console.log('   - Updated get_leads_for_va() function to include va_notes field')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

runMigration()
