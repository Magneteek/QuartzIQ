/**
 * Test Script: Send Test Alert to GoHighLevel Webhook
 *
 * This script sends a sample negative review alert to your GHL inbound webhook
 * to verify the automation integration is working correctly.
 */

import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

// Your GHL Webhook URL
const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL || 'https://services.leadconnectorhq.com/hooks/8opNHzwsADYRdyueAita/webhook-trigger/d85aa50b-8c6f-4458-9f5e-17f5a7df5a8e'

async function sendAlertToGHLWebhook() {
  try {
    console.log('🧪 Testing GHL Webhook Integration...\n')

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
        cma.detected_at,
        b.name as business_name,
        b.email as business_email,
        b.phone as business_phone,
        b.website as business_website,
        b.address as business_address,
        b.city as business_city,
        b.country_code as business_country,
        b.category as business_category,
        b.place_id,
        r.url as review_url
      FROM customer_monitoring_alerts cma
      INNER JOIN businesses b ON cma.business_id = b.id
      LEFT JOIN reviews r ON cma.review_id = r.id
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
    console.log(`   Rating: ${alert.review_stars} ⭐`)
    console.log(`   Review: "${alert.review_text?.substring(0, 50)}..."`)
    console.log('')

    // Prepare webhook payload
    const webhookData = {
      // Alert metadata
      alert_id: alert.id,
      alert_type: 'negative_review',
      severity: alert.severity,
      detected_at: new Date(alert.detected_at).toISOString(),

      // Business information
      business_id: alert.business_id,
      business_name: alert.business_name,
      business_email: alert.business_email || '',
      business_phone: alert.business_phone || '',
      business_website: alert.business_website || '',
      business_address: alert.business_address || '',
      business_city: alert.business_city || '',
      business_country: alert.business_country || 'NL',
      business_category: alert.business_category || '',
      place_id: alert.place_id || '',
      google_url: alert.place_id ? `https://www.google.com/maps/place/?q=place_id:${alert.place_id}` : '',

      // Review information
      review_rating: alert.review_stars,
      review_text: alert.review_text || '',
      reviewer_name: alert.reviewer_name || 'Anonymous',
      review_date: alert.review_date ? new Date(alert.review_date).toISOString().split('T')[0] : '',
      review_url: alert.review_url || '',

      // Action URL
      action_url: `http://localhost:3069/dashboard/monitoring`,

      // Tags for automation filtering
      tags: [
        'Negative-Review-Alert',
        'Customer',
        `${alert.severity}-Severity`,
        `${alert.review_stars}-Star-Review`
      ].join(',')
    }

    console.log('📤 Sending to GHL Webhook...')
    console.log('   URL:', GHL_WEBHOOK_URL.substring(0, 60) + '...')
    console.log('')
    console.log('📦 Payload:')
    console.log(JSON.stringify(webhookData, null, 2))
    console.log('')

    // Send to GHL webhook
    const response = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookData)
    })

    if (!response.ok) {
      console.error('❌ Webhook Error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('   Response:', errorText)
      await pool.end()
      return
    }

    console.log('✅ Alert sent successfully!')
    console.log(`   HTTP Status: ${response.status}`)
    console.log('')

    console.log('🎉 Test complete!')
    console.log('')
    console.log('📋 Next Steps:')
    console.log('   1. Go to GHL → Automation → Your Workflow')
    console.log('   2. Check "Recent Executions" or workflow history')
    console.log('   3. Verify the webhook trigger fired')
    console.log('   4. Check if any actions executed (email, SMS, contact creation, etc.)')
    console.log('')
    console.log('💡 Tip: In your GHL automation, you can access these fields:')
    console.log('   - {{business_name}}')
    console.log('   - {{review_rating}}')
    console.log('   - {{review_text}}')
    console.log('   - {{reviewer_name}}')
    console.log('   - {{severity}}')
    console.log('   - {{action_url}} (link to monitoring dashboard)')
    console.log('')

    await pool.end()

  } catch (error) {
    console.error('❌ Error:', error)
    await pool.end()
    throw error
  }
}

sendAlertToGHLWebhook()
