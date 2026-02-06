import { Pool } from 'pg'
import * as fs from 'fs'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function runMigration() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  })

  try {
    console.log('🔄 Running migration 015: Update get_leads_for_va to show prospects and leads...\n')

    const migration = fs.readFileSync('database/migrations/015_update_get_leads_for_va_lifecycle.sql', 'utf8')
    await pool.query(migration)

    console.log('✅ Migration 015 completed successfully!\n')

    // Test the function
    console.log('🧪 Testing updated function...')
    const result = await pool.query('SELECT * FROM get_leads_for_va(5, 0)')
    console.log(`   Found ${result.rows.length} businesses`)

    if (result.rows.length > 0) {
      console.log('\n📋 Sample businesses:')
      result.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.business_name} (${row.lifecycle_stage})`)
      })
    }

    // Get stats
    const stats = await pool.query('SELECT * FROM get_lead_stats()')
    console.log('\n📊 Updated statistics:')
    console.log(`   Total leads: ${stats.rows[0].total_leads}`)
    console.log(`   Ready for enrichment: ${stats.rows[0].ready_for_enrichment}`)
    console.log(`   Added today: ${stats.rows[0].added_today}`)
    console.log(`   Added this week: ${stats.rows[0].added_this_week}`)
    console.log(`   Average rating: ${stats.rows[0].average_rating}`)

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    if (error.detail) console.error('   Detail:', error.detail)
    if (error.hint) console.error('   Hint:', error.hint)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigration()
