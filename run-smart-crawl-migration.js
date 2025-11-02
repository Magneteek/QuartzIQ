/**
 * Apply Smart Crawl Strategy Migration
 * Adds fields for two-tier crawling system
 */

require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  connectionString: process.env.DATABASE_URL,
})

async function runMigration() {
  try {
    console.log('📊 Starting Smart Crawl Strategy Migration...\n')

    // Read the migration SQL file
    const migrationSQL = fs.readFileSync(
      './database/migrations/004_smart_crawl_strategy.sql',
      'utf8'
    )

    console.log('🔄 Executing migration SQL...\n')

    // Execute the migration
    await pool.query(migrationSQL)

    console.log('✅ Migration completed successfully!\n')

    // Verify the changes
    console.log('🔍 Verifying new columns...\n')

    const verifyResult = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'businesses'
        AND column_name IN (
          'last_review_check_at',
          'review_check_count',
          'had_reviews_on_discovery',
          'crawl_priority'
        )
      ORDER BY column_name
    `)

    console.log('New columns added:')
    verifyResult.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type})`)
    })
    console.log('')

    // Show summary statistics
    console.log('📈 Crawl Priority Distribution:\n')

    const statsResult = await pool.query(`
      SELECT
        crawl_priority,
        COUNT(*) as count,
        ROUND(AVG(reviews_count)::NUMERIC, 2) as avg_reviews
      FROM businesses
      GROUP BY crawl_priority
      ORDER BY
        CASE crawl_priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'standard' THEN 3
          WHEN 'low' THEN 4
        END
    `)

    statsResult.rows.forEach(row => {
      const bar = '█'.repeat(Math.floor(row.count / 50))
      console.log(`  ${row.crawl_priority.padEnd(10)} ${String(row.count).padStart(5)} businesses  ${bar}`)
      console.log(`  ${' '.repeat(10)} Avg: ${row.avg_reviews} reviews\n`)
    })

    // Show 0-review businesses ready for check
    const zeroReviewsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM businesses
      WHERE reviews_count = 0 OR reviews_count IS NULL
    `)

    console.log(`📋 Zero-Review Businesses: ${zeroReviewsResult.rows[0].count}`)
    console.log('   These will be checked monthly for new reviews\n')

    console.log('═══════════════════════════════════════════════════')
    console.log('🎉 Smart Crawl Strategy is now active!')
    console.log('═══════════════════════════════════════════════════\n')

    console.log('Next steps:')
    console.log('1. Test the API: curl http://localhost:3000/api/crawl/targets?mode=primary&limit=10')
    console.log('2. Check secondary targets: curl http://localhost:3000/api/crawl/targets?mode=secondary&limit=10')
    console.log('3. Read the full guide: docs/SMART-CRAWL-STRATEGY.md\n')

    await pool.end()
    process.exit(0)

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error(error.stack)
    await pool.end()
    process.exit(1)
  }
}

runMigration()
