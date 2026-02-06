import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

async function checkPlaceIds() {
  try {
    console.log('\n🔍 Checking Place IDs in Database\n')
    console.log('═'.repeat(80))

    // Get some dentist businesses
    const result = await pool.query(`
      SELECT
        name,
        place_id,
        category,
        city,
        rating,
        reviews_count,
        created_at
      FROM businesses
      WHERE category ILIKE '%tand%' OR category ILIKE '%dent%'
      ORDER BY created_at DESC
      LIMIT 10
    `)

    if (result.rows.length === 0) {
      console.log('❌ No dentist businesses found in database')
      return
    }

    console.log(`\n✅ Found ${result.rows.length} dentist businesses:\n`)

    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name}`)
      console.log(`   Place ID: ${row.place_id}`)
      console.log(`   Category: ${row.category}`)
      console.log(`   City: ${row.city}`)
      console.log(`   Rating: ${row.rating} (${row.reviews_count} reviews)`)
      console.log(`   Google Maps: https://www.google.com/maps/search/?api=1&query_place_id=${row.place_id}`)
      console.log('')
    })

    console.log('═'.repeat(80))
    console.log('\n✅ Test each Google Maps URL above to verify place IDs are valid\n')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await pool.end()
  }
}

checkPlaceIds()
