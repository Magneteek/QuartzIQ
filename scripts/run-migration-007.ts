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
      '../database/migrations/007_add_nextauth_tables.sql'
    )
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    console.log('📝 Running migration 007_add_nextauth_tables.sql...')

    // Execute migration
    await pool.query(migrationSQL)

    console.log('✅ Migration 007 completed successfully!')
    console.log('\n📋 Summary:')
    console.log('   - Added password_hash, email_verified, image to users table')
    console.log('   - Created accounts table (for OAuth providers)')
    console.log('   - Created sessions table (for session management)')
    console.log('   - Created verification_tokens table (for email verification)')
    console.log('   - Created audit_log table (for tracking user actions)')
    console.log('   - Added indexes for optimal performance')
    console.log('   - Created helper functions for user queries and audit logging')
    console.log('   - Inserted default admin user (admin@quartziq.com)')
    console.log('\n⚠️  IMPORTANT: Change the default admin password after first login!')
    console.log('   Default password: AdminPassword123!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

runMigration()
