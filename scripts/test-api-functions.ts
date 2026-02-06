import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

async function testFunctions() {
  try {
    console.log('🧪 Testing get_lead_stats()...')
    const statsResult = await pool.query('SELECT * FROM get_lead_stats()')
    console.log('✅ get_lead_stats() working!')
    console.log('Stats:', statsResult.rows[0])

    console.log('\n🧪 Testing get_leads_for_va()...')
    const leadsResult = await pool.query(
      'SELECT * FROM get_leads_for_va($1, $2, $3, $4, $5)',
      [15, 0, null, 'created_at', 'DESC']
    )
    console.log(`✅ get_leads_for_va() working! Found ${leadsResult.rows.length} leads`)

    if (leadsResult.rows.length > 0) {
      console.log('\nFirst lead:')
      console.log({
        business_name: leadsResult.rows[0].business_name,
        email: leadsResult.rows[0].email,
        phone: leadsResult.rows[0].phone,
        rating: leadsResult.rows[0].rating,
        total_reviews: leadsResult.rows[0].total_reviews,
        created_at: leadsResult.rows[0].created_at,
      })
    }

    console.log('\n✨ All functions working correctly!')
  } catch (error) {
    console.error('❌ Error testing functions:', error)
  } finally {
    await pool.end()
  }
}

testFunctions()
