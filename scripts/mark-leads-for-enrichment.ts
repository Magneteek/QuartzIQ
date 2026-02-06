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

async function markLeadsForEnrichment() {
  try {
    console.log('📝 Marking test leads as ready for enrichment...')

    // Mark 3 out of 5 leads as ready for enrichment
    const result = await pool.query(
      `UPDATE businesses
       SET ready_for_enrichment = TRUE,
           enrichment_status = 'pending',
           enrichment_priority = CASE
             WHEN name LIKE '%Dental%' THEN 90
             WHEN name LIKE '%Fitness%' THEN 75
             WHEN name LIKE '%Auto%' THEN 60
             ELSE 50
           END,
           va_notes = CASE
             WHEN name LIKE '%Dental%' THEN 'Owner very active on social media, responds to reviews. High priority!'
             WHEN name LIKE '%Fitness%' THEN 'Multiple negative reviews about billing. Good prospect for review removal.'
             WHEN name LIKE '%Auto%' THEN 'Family-owned business, responsive to customer feedback.'
             ELSE va_notes
           END
       WHERE lifecycle_stage = 'lead'
         AND (name LIKE '%Dental%' OR name LIKE '%Fitness%' OR name LIKE '%Auto%')
       RETURNING name, enrichment_priority`
    )

    console.log(`✅ Marked ${result.rowCount} leads as ready for enrichment:`)
    result.rows.forEach((row) => {
      console.log(`   - ${row.name} (Priority: ${row.enrichment_priority})`)
    })

    console.log('\n📊 Enrichment queue summary:')
    const summary = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE ready_for_enrichment = TRUE) as ready_count,
         AVG(enrichment_priority) as avg_priority
       FROM businesses
       WHERE lifecycle_stage = 'lead'`
    )

    console.log(`   Total ready for enrichment: ${summary.rows[0].ready_count}`)
    console.log(
      `   Average priority: ${parseFloat(summary.rows[0].avg_priority || 0).toFixed(1)}`
    )

    console.log('\n✨ Ready to test enrichment workflow!')
    console.log('   Navigate to: http://localhost:3069/dashboard/enrichment')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await pool.end()
  }
}

markLeadsForEnrichment()
