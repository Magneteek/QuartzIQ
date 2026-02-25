import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

interface EnrichmentStats {
  totalBusinesses: number
  readyForEnrichment: number
  hasWebsite: number
  enrichmentAttempted: number
  enrichmentCompleted: number
  hasEmail: number
  hasPhone: number
  apolloUsed: number
  claudeOnly: number
  apifyOnly: number
  avgConfidence: number
  avgCostPerBusiness: number
  totalCost: number
}

async function evaluateApolloSuccessRate() {
  console.log('🔍 Evaluating Apollo Enrichment Success Rate...\n')

  try {
    // 1. Get overall enrichment statistics
    const statsQuery = `
      SELECT
        COUNT(*) as total_businesses,
        COUNT(CASE WHEN ready_for_enrichment = true THEN 1 END) as ready_for_enrichment,
        COUNT(CASE WHEN website IS NOT NULL AND website != '' THEN 1 END) as has_website,
        COUNT(CASE WHEN enrichment_status IN ('in_progress', 'completed') THEN 1 END) as enrichment_attempted,
        COUNT(CASE WHEN enrichment_status = 'completed' THEN 1 END) as enrichment_completed,
        COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as has_email,
        COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as has_phone
      FROM businesses
      WHERE lifecycle_stage IN ('lead', 'qualified')
    `

    const statsResult = await pool.query(statsQuery)
    const stats = statsResult.rows[0]

    console.log('📊 Overall Statistics:')
    console.log('─────────────────────────────────────────')
    console.log(`Total Businesses: ${stats.total_businesses}`)
    console.log(`Ready for Enrichment: ${stats.ready_for_enrichment}`)
    console.log(`Has Website: ${stats.has_website}`)
    console.log(`Enrichment Attempted: ${stats.enrichment_attempted}`)
    console.log(`Enrichment Completed: ${stats.enrichment_completed}`)
    console.log(`Has Email: ${stats.has_email}`)
    console.log(`Has Phone: ${stats.has_phone}`)
    console.log('')

    // 2. Get enrichment method breakdown
    const enrichmentMethodsQuery = `
      SELECT
        reveal_method,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence,
        SUM(apollo_search_cost + apollo_enrich_cost + apify_leads_cost) as total_cost,
        AVG(apollo_search_cost + apollo_enrich_cost + apify_leads_cost) as avg_cost
      FROM contact_enrichments
      GROUP BY reveal_method
      ORDER BY count DESC
    `

    const methodsResult = await pool.query(enrichmentMethodsQuery)

    console.log('🎯 Enrichment Methods Used:')
    console.log('─────────────────────────────────────────')

    if (methodsResult.rows.length === 0) {
      console.log('⚠️  No enrichment data found yet!')
    } else {
      methodsResult.rows.forEach(row => {
        console.log(`\n${row.reveal_method}:`)
        console.log(`  Count: ${row.count}`)
        console.log(`  Avg Confidence: ${(row.avg_confidence || 0).toFixed(1)}%`)
        console.log(`  Total Cost: $${(row.total_cost || 0).toFixed(2)}`)
        console.log(`  Avg Cost: $${(row.avg_cost || 0).toFixed(3)}`)
      })
    }
    console.log('')

    // 3. Get success rate by method
    const successRateQuery = `
      SELECT
        reveal_method,
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as found_email,
        COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as found_phone,
        COUNT(CASE WHEN (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '') THEN 1 END) as found_contact,
        ROUND(100.0 * COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) / COUNT(*), 1) as email_rate,
        ROUND(100.0 * COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) / COUNT(*), 1) as phone_rate,
        ROUND(100.0 * COUNT(CASE WHEN (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '') THEN 1 END) / COUNT(*), 1) as contact_rate
      FROM contact_enrichments
      GROUP BY reveal_method
      ORDER BY total_attempts DESC
    `

    const successRateResult = await pool.query(successRateQuery)

    console.log('📈 Success Rates by Method:')
    console.log('─────────────────────────────────────────')

    if (successRateResult.rows.length === 0) {
      console.log('⚠️  No enrichment attempts found yet!')
    } else {
      successRateResult.rows.forEach(row => {
        console.log(`\n${row.reveal_method}:`)
        console.log(`  Total Attempts: ${row.total_attempts}`)
        console.log(`  Email Found: ${row.found_email} (${row.email_rate}%)`)
        console.log(`  Phone Found: ${row.found_phone} (${row.phone_rate}%)`)
        console.log(`  Any Contact Found: ${row.found_contact} (${row.contact_rate}%)`)
      })
    }
    console.log('')

    // 4. Get sample businesses ready for enrichment
    const sampleQuery = `
      SELECT
        id,
        name,
        website,
        category,
        rating,
        reviews_count,
        city,
        country_code,
        enrichment_status,
        ready_for_enrichment
      FROM businesses
      WHERE ready_for_enrichment = true
        AND lifecycle_stage IN ('lead', 'qualified')
        AND (enrichment_status IS NULL OR enrichment_status = 'pending')
      ORDER BY enrichment_priority DESC NULLS LAST
      LIMIT 10
    `

    const sampleResult = await pool.query(sampleQuery)

    console.log('📋 Sample Businesses Ready for Enrichment:')
    console.log('─────────────────────────────────────────')

    if (sampleResult.rows.length === 0) {
      console.log('✅ No businesses currently in queue!')
    } else {
      sampleResult.rows.forEach((business, i) => {
        console.log(`\n${i + 1}. ${business.name}`)
        console.log(`   Website: ${business.website || 'N/A'}`)
        console.log(`   Category: ${business.category || 'N/A'}`)
        console.log(`   Location: ${business.city || 'N/A'}, ${business.country_code || 'N/A'}`)
        console.log(`   Rating: ${business.rating || 'N/A'} (${business.reviews_count || 0} reviews)`)
        console.log(`   Status: ${business.enrichment_status || 'pending'}`)
      })
    }
    console.log('')

    // 5. Calculate ROI metrics
    const roiQuery = `
      SELECT
        COUNT(*) as total_enrichments,
        COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as successful_enrichments,
        SUM(apollo_search_cost + apollo_enrich_cost + apify_leads_cost) as total_cost_usd,
        ROUND(AVG(apollo_search_cost + apollo_enrich_cost + apify_leads_cost)::numeric, 3) as avg_cost_per_attempt,
        ROUND((SUM(apollo_search_cost + apollo_enrich_cost + apify_leads_cost) /
               NULLIF(COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END), 0))::numeric, 2) as cost_per_success
      FROM contact_enrichments
    `

    const roiResult = await pool.query(roiQuery)
    const roi = roiResult.rows[0]

    console.log('💰 Cost & ROI Analysis:')
    console.log('─────────────────────────────────────────')

    if (roi.total_enrichments > 0) {
      console.log(`Total Enrichment Attempts: ${roi.total_enrichments}`)
      console.log(`Successful Enrichments: ${roi.successful_enrichments}`)
      console.log(`Success Rate: ${((roi.successful_enrichments / roi.total_enrichments) * 100).toFixed(1)}%`)
      console.log(`Total Cost: $${(roi.total_cost_usd || 0).toFixed(2)}`)
      console.log(`Avg Cost per Attempt: $${(roi.avg_cost_per_attempt || 0).toFixed(3)}`)
      console.log(`Cost per Success: $${(roi.cost_per_success || 0).toFixed(2)}`)
      console.log('')

      // Calculate if Apollo is worth it
      const apolloMonthlyBasic = 49 // $49/month for Basic plan
      const apolloMonthlyPro = 99 // $99/month for Pro plan
      const breakevenBasic = Math.ceil(apolloMonthlyBasic / (roi.cost_per_success || 1))
      const breakevenPro = Math.ceil(apolloMonthlyPro / (roi.cost_per_success || 1))

      console.log('🎯 Apollo.io Subscription Analysis:')
      console.log('─────────────────────────────────────────')
      console.log(`Basic Plan ($49/month):`)
      console.log(`  Need ${breakevenBasic} successful enrichments/month to break even`)
      console.log(`  That's ~${Math.ceil(breakevenBasic / ((roi.successful_enrichments / roi.total_enrichments) || 0.5))} attempts/month`)
      console.log('')
      console.log(`Pro Plan ($99/month):`)
      console.log(`  Need ${breakevenPro} successful enrichments/month to break even`)
      console.log(`  That's ~${Math.ceil(breakevenPro / ((roi.successful_enrichments / roi.total_enrichments) || 0.5))} attempts/month`)
    } else {
      console.log('⚠️  No enrichment cost data available yet!')
      console.log('')
      console.log('💡 Apollo.io Pricing Reference:')
      console.log('   Basic: $49/month (1,000 credits)')
      console.log('   Professional: $99/month (2,000 credits)')
      console.log('   Organization: $149/month (3,000 credits)')
      console.log('')
      console.log('   Typical cost per enrichment: $0.10-0.15')
    }
    console.log('')

    // 6. Recommendations
    console.log('💡 Recommendations:')
    console.log('─────────────────────────────────────────')

    if (roi.total_enrichments === 0) {
      console.log('1. ⚠️  No enrichment data yet - run test enrichments first!')
      console.log('2. 🧪 Test with 10-20 businesses to evaluate success rate')
      console.log('3. 📊 Compare Claude-only vs Apollo enrichment quality')
      console.log('4. 💰 Calculate actual cost per successful contact')
      console.log('5. 🎯 Then decide if Apollo subscription is worth it')
    } else {
      const successRate = (roi.successful_enrichments / roi.total_enrichments) * 100
      const costPerSuccess = roi.cost_per_success || 0

      if (successRate >= 60 && costPerSuccess <= 0.50) {
        console.log('✅ STRONG ROI - Apollo subscription recommended!')
        console.log('   - High success rate (>=60%)')
        console.log('   - Reasonable cost per success (<=50¢)')
        console.log('   - Consider Pro plan for scale')
      } else if (successRate >= 40 && costPerSuccess <= 1.00) {
        console.log('⚠️  MODERATE ROI - Apollo could be worth it')
        console.log('   - Decent success rate (40-60%)')
        console.log('   - Acceptable cost per success (50¢-$1)')
        console.log('   - Start with Basic plan, monitor usage')
      } else {
        console.log('❌ LOW ROI - Reconsider Apollo subscription')
        console.log('   - Low success rate (<40%) OR high cost (>$1)')
        console.log('   - Focus on Claude + web scraping first')
        console.log('   - Only use Apollo for high-value leads')
      }
    }
    console.log('')

  } catch (error) {
    console.error('❌ Error evaluating success rate:', error)
    throw error
  } finally {
    await pool.end()
  }
}

evaluateApolloSuccessRate()
  .then(() => {
    console.log('✅ Evaluation complete!')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Evaluation failed:', error)
    process.exit(1)
  })
