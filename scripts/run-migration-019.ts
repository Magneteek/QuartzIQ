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
    console.log('🔄 Running Migration 019: Fix google_maps_url format for Apify...\n')

    // Check how many businesses will be affected
    const checkResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM businesses
      WHERE google_maps_url LIKE '%google.com/maps/search%'
        AND place_id IS NOT NULL
        AND place_id != ''
    `)

    const affectedCount = parseInt(checkResult.rows[0].count)
    console.log(`   Found ${affectedCount} businesses with Search API format URLs`)

    if (affectedCount === 0) {
      console.log('✅ No businesses need updating!\n')
      await pool.end()
      return
    }

    // Show examples before
    const beforeResult = await pool.query(`
      SELECT name, google_maps_url
      FROM businesses
      WHERE google_maps_url LIKE '%google.com/maps/search%'
      LIMIT 3
    `)

    console.log('\n📋 Example BEFORE (Search API format - unreliable):')
    beforeResult.rows.forEach(row => {
      console.log(`   ${row.name}`)
      console.log(`   ${row.google_maps_url.substring(0, 80)}...`)
    })

    const migrationPath = path.join(process.cwd(), 'database/migrations/019_fix_google_maps_url_format.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    await pool.query(migrationSQL)

    // Show examples after
    const afterResult = await pool.query(`
      SELECT name, google_maps_url
      FROM businesses
      WHERE name = ANY($1::text[])
    `, [beforeResult.rows.map(r => r.name)])

    console.log('\n✅ Example AFTER (place_id format - reliable):')
    afterResult.rows.forEach(row => {
      console.log(`   ${row.name}`)
      console.log(`   ${row.google_maps_url}`)
    })

    console.log(`\n✅ Migration 019 completed successfully!`)
    console.log(`   Updated ${affectedCount} businesses`)
    console.log('\n🎯 Review scraping will now use the correct business!')
    console.log('')

    await pool.end()
  } catch (error) {
    console.error('❌ Migration failed:', error)
    await pool.end()
    throw error
  }
}

runMigration()
