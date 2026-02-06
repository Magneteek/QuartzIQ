import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

async function testPlaceIdQuery() {
  try {
    // Test with actual place_ids from the database
    const testPlaceIds = [
      'ChIJX-2rTqEJxkcRhjlIZp4bqFk', // Het Scheepvaartmuseum
      'ChIJX1rTlu8JxkcRGsV8-a4oKMI',  // Van Gogh Museum
    ]

    console.log('Testing place_id query...')
    console.log('Place IDs to query:', testPlaceIds)
    console.log('')

    const result = await pool.query(`
      SELECT
        place_id,
        name,
        google_maps_url,
        entry_method
      FROM businesses
      WHERE place_id = ANY($1::varchar[])
    `, [testPlaceIds])

    console.log(`Found ${result.rows.length} businesses:`)
    result.rows.forEach(row => {
      console.log(`  - ${row.name}`)
      console.log(`    place_id: ${row.place_id}`)
      console.log(`    google_maps_url: ${row.google_maps_url || 'NULL'}`)
      console.log(`    entry_method: ${row.entry_method}`)
      console.log('')
    })

    if (result.rows.length === 0) {
      console.log('❌ NO BUSINESSES FOUND!')
      console.log('This is the problem - the query is not matching the place_ids')
    } else if (result.rows.length < testPlaceIds.length) {
      console.log('⚠️  Found fewer businesses than expected')
      console.log(`   Expected: ${testPlaceIds.length}, Found: ${result.rows.length}`)
    } else {
      console.log('✅ Query working correctly!')
    }

    // Check for google_maps_url field - this is required for review crawling
    const missingUrl = result.rows.filter(r => !r.google_maps_url)
    if (missingUrl.length > 0) {
      console.log('')
      console.log('⚠️  WARNING: Some businesses are missing google_maps_url:')
      missingUrl.forEach(r => {
        console.log(`   - ${r.name} (place_id: ${r.place_id})`)
      })
      console.log('')
      console.log('This could cause "no place found" errors during review crawling!')
    }

    await pool.end()
  } catch (error) {
    console.error('Error:', error)
    await pool.end()
    throw error
  }
}

testPlaceIdQuery()
