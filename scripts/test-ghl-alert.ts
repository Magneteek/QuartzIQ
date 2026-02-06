/**
 * Test Script: Send Test Alert to GoHighLevel
 *
 * This script sends a sample negative review alert to GHL
 * to verify the webhook integration is working correctly.
 */

import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

// GHL Configuration
const GHL_API_KEY = process.env.GHL_API_KEY
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID

async function sendAlertToGHL() {
  try {
    console.log('🧪 Testing GHL Alert Integration...\n')

    // Get one of our test alerts
    const alertResult = await pool.query(`
      SELECT
        cma.id,
        cma.business_id,
        cma.review_stars,
        cma.review_text,
        cma.reviewer_name,
        cma.review_date,
        cma.severity,
        b.name as business_name,
        b.email as business_email,
        b.phone as business_phone,
        b.website as business_website,
        b.address as business_address,
        b.city as business_city,
        b.country_code as business_country,
        b.category as business_category,
        b.place_id
      FROM customer_monitoring_alerts cma
      INNER JOIN businesses b ON cma.business_id = b.id
      WHERE cma.resolved_at IS NULL
      LIMIT 1
    `)

    if (alertResult.rows.length === 0) {
      console.log('❌ No unresolved alerts found to test with')
      await pool.end()
      return
    }

    const alert = alertResult.rows[0]

    console.log(`📍 Sending alert for: ${alert.business_name}`)
    console.log(`   Severity: ${alert.severity}`)
    console.log(`   Rating: ${alert.review_stars} stars`)
    console.log('')

    // Prepare GHL contact data
    const contactData = {
      name: alert.business_name,
      email: alert.business_email || `${alert.business_name.toLowerCase().replace(/\s+/g, '')}@example.com`,
      phone: alert.business_phone || undefined,
      website: alert.business_website || undefined,
      address1: alert.business_address || undefined,
      city: alert.business_city || undefined,
      country: alert.business_country || 'NL',
      tags: [
        'Negative-Review-Alert',
        'Customer',
        `${alert.severity}-Severity`,
        `${alert.review_stars}-Star-Review`
      ],
      customField: {
        business_name: alert.business_name,
        review_rating: alert.review_stars,
        review_text: alert.review_text,
        review_date: alert.review_date ? new Date(alert.review_date).toISOString().split('T')[0] : undefined,
        reviewer_name: alert.reviewer_name,
        alert_severity: alert.severity,
        place_id: alert.place_id,
        business_category: alert.business_category
      }
    }

    console.log('📤 Sending to GHL API...')
    console.log('   Endpoint: https://rest.gohighlevel.com/v1/contacts/')
    console.log('   Location ID:', GHL_LOCATION_ID)
    console.log('')

    // Send to GHL
    const response = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify({
        ...contactData,
        locationId: GHL_LOCATION_ID
      })
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('❌ GHL API Error:', response.status)
      console.error('   Response:', JSON.stringify(responseData, null, 2))
      await pool.end()
      return
    }

    console.log('✅ Alert sent successfully!')
    console.log(`   GHL Contact ID: ${responseData.contact?.id || 'N/A'}`)
    console.log('')

    // Create opportunity
    if (responseData.contact?.id) {
      console.log('📊 Creating opportunity...')

      const opportunityResponse = await fetch('https://rest.gohighlevel.com/v1/opportunities/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({
          contactId: responseData.contact.id,
          locationId: GHL_LOCATION_ID,
          name: `Negative Review - ${alert.business_name}`,
          pipelineStageId: 'negative_review_stage', // You'll need to get this from GHL
          status: 'open',
          monetaryValue: 500
        })
      })

      const opportunityData = await opportunityResponse.json()

      if (opportunityResponse.ok) {
        console.log('✅ Opportunity created!')
        console.log(`   Opportunity ID: ${opportunityData.opportunity?.id || 'N/A'}`)
      } else {
        console.log('⚠️  Opportunity creation failed (this is normal if pipeline not configured)')
        console.log('   You can create the pipeline manually in GHL')
      }
    }

    console.log('')
    console.log('🎉 Test complete!')
    console.log('')
    console.log('📋 Next Steps:')
    console.log('   1. Go to GHL Contacts and search for:', alert.business_name)
    console.log('   2. Verify all custom fields are populated')
    console.log('   3. Check that tags were applied')
    console.log('   4. Check if automation workflow triggered')
    console.log('')

    await pool.end()

  } catch (error) {
    console.error('❌ Error:', error)
    await pool.end()
    throw error
  }
}

// Check environment variables
if (!GHL_API_KEY || !GHL_LOCATION_ID) {
  console.error('❌ Missing required environment variables:')
  if (!GHL_API_KEY) console.error('   - GHL_API_KEY')
  if (!GHL_LOCATION_ID) console.error('   - GHL_LOCATION_ID')
  console.error('\nPlease configure these in your .env.local file')
  process.exit(1)
}

sendAlertToGHL()
