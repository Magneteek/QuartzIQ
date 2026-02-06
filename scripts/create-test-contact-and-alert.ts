/**
 * Create Test Contact and Trigger Alert
 * Creates a real business with monitoring enabled and triggers a negative review alert
 */

import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL || 'https://services.leadconnectorhq.com/hooks/8opNHzwsADYRdyueAita/webhook-trigger/d85aa50b-8c6f-4458-9f5e-17f5a7df5a8e'

async function createTestContactAndAlert() {
  try {
    console.log('🧪 Creating Test Contact: Balzan Cars\n')

    // 1. Check if business already exists
    const existingBusiness = await pool.query(
      'SELECT id FROM businesses WHERE name ILIKE $1 OR email = $2',
      ['Balzan cars', 'kristjan@krisbal.com']
    )

    let businessId: string

    if (existingBusiness.rows.length > 0) {
      businessId = existingBusiness.rows[0].id
      console.log('✅ Business already exists, updating...')

      // Update existing business
      await pool.query(`
        UPDATE businesses SET
          name = $1,
          email = $2,
          phone = $3,
          website = $4,
          category = $5,
          place_id = $6,
          is_paying_customer = TRUE,
          monitoring_enabled = TRUE,
          lifecycle_stage = 'customer',
          customer_tier = 'premium',
          customer_since = CURRENT_DATE,
          monitoring_frequency_hours = 336,
          next_monitoring_check = NOW()
        WHERE id = $7
      `, [
        'Balzan Cars',
        'kristjan@krisbal.com',
        '+34 699 636 573',
        'https://krisbal.com',
        'High-End Car Dealers',
        'balzancars_nl_place_id', // Placeholder place_id
        businessId
      ])

      console.log(`   Updated business ID: ${businessId}`)
    } else {
      console.log('📝 Creating new business...')

      // Create new business
      const businessResult = await pool.query(`
        INSERT INTO businesses (
          name,
          email,
          phone,
          website,
          address,
          city,
          country_code,
          category,
          place_id,
          rating,
          reviews_count,
          is_paying_customer,
          monitoring_enabled,
          lifecycle_stage,
          customer_tier,
          customer_since,
          monitoring_frequency_hours,
          monitoring_alert_threshold,
          next_monitoring_check,
          data_source
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        ) RETURNING id
      `, [
        'Balzan Cars',
        'kristjan@krisbal.com',
        '+34 699 636 573',
        'https://krisbal.com',
        'Balzancars.nl Location', // Address
        'Netherlands', // City
        'nl', // Country
        'High-End Car Dealers',
        'balzancars_nl_place_id', // Placeholder place_id
        4.2, // Rating
        45, // Reviews count
        true, // is_paying_customer
        true, // monitoring_enabled
        'customer', // lifecycle_stage
        'premium', // customer_tier
        new Date('2025-10-01'), // customer_since
        336, // monitoring_frequency_hours (14 days)
        3, // monitoring_alert_threshold
        new Date(), // next_monitoring_check (now)
        'manual' // data_source
      ])

      businessId = businessResult.rows[0].id
      console.log(`✅ Created business ID: ${businessId}`)
    }

    // 2. Create a negative review
    console.log('\n📝 Creating negative review...')

    const reviewText = `Wat een drama, ik heb hier mijn auto laten repareren ! loop ik in de nacht eenrondje door de stad, zie ik tot mijn verbazing iemand rondjes rijden in mijn auto door de uitgaansstraat! zonder toestemming !! onbetrouwbaar & onprofessioneel  !`

    // Check if review already exists
    const existingReview = await pool.query(
      'SELECT id FROM reviews WHERE review_id = $1',
      ['balzan_test_review_001']
    )

    let reviewId: string

    if (existingReview.rows.length > 0) {
      reviewId = existingReview.rows[0].id
      console.log(`   Review already exists, using ID: ${reviewId}`)
    } else {
      const reviewResult = await pool.query(`
        INSERT INTO reviews (
          business_id,
          review_id,
          text,
          rating,
          published_date,
          reviewer_name,
          url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        businessId,
        'balzan_test_review_002', // Unique review ID (incremented for new test)
        reviewText,
        2, // 2-star review
        new Date('2025-10-01'),
        'Ontevreden Klant',
        'https://maps.app.goo.gl/g4bH1x7iqBR824Zs6'
      ])

      reviewId = reviewResult.rows[0].id
      console.log(`✅ Created review ID: ${reviewId}`)
    }

    // 3. Create monitoring alert
    console.log('\n🚨 Creating monitoring alert...')

    const alertResult = await pool.query(`
      INSERT INTO customer_monitoring_alerts (
        business_id,
        alert_type,
        severity,
        review_id,
        review_stars,
        review_text,
        reviewer_name,
        review_date,
        detected_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `, [
      businessId,
      'new_negative_review',
      'high', // 2-star review = high severity
      reviewId,
      2,
      reviewText,
      'Ontevreden Klant',
      new Date('2025-10-01')
    ])

    console.log(`✅ Created alert ID: ${alertResult.rows[0].id}`)

    // 4. Get review URL from database
    const reviewData = await pool.query(
      'SELECT url FROM reviews WHERE id = $1',
      [reviewId]
    )
    const reviewUrl = reviewData.rows[0]?.url || ''
    console.log(`   Review URL: ${reviewUrl}`)

    // 5. Send alert to GHL webhook
    console.log('\n📤 Sending alert to GHL webhook...')

    const webhookPayload = {
      alert_id: alertResult.rows[0].id,
      alert_type: 'negative_review',
      severity: 'high',
      detected_at: new Date().toISOString(),

      business_id: businessId,
      business_name: 'Balzan Cars',
      business_email: 'kristjan@krisbal.com',
      business_phone: '+34 699 636 573',
      business_website: 'https://krisbal.com',
      business_address: 'Balzancars.nl Location',
      business_city: 'Netherlands',
      business_country: 'nl',
      business_category: 'High-End Car Dealers',
      place_id: 'balzancars_nl_place_id',
      google_url: 'https://balzancars.nl',

      review_rating: 2,
      review_text: reviewText,
      reviewer_name: 'Ontevreden Klant',
      review_date: '2025-10-01',
      review_url: reviewUrl,

      action_url: 'http://localhost:3069/dashboard/monitoring',
      tags: 'Negative-Review-Alert,Customer,high-Severity,2-Star-Review'
    }

    const response = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    })

    if (!response.ok) {
      console.error('❌ Webhook failed:', response.status)
      const errorText = await response.text()
      console.error('   Response:', errorText)
    } else {
      console.log('✅ Alert sent to GHL successfully!')
      console.log(`   HTTP Status: ${response.status}`)
    }

    // 5. Summary
    console.log('\n🎉 Test Complete!')
    console.log('\n📊 Summary:')
    console.log(`   Business: Balzan Cars`)
    console.log(`   Contact: Kristjan Balzan`)
    console.log(`   Email: kristjan@krisbal.com`)
    console.log(`   Phone: +34 699 636 573`)
    console.log(`   Review Rating: 2 ⭐`)
    console.log(`   Alert Severity: HIGH`)
    console.log('')
    console.log('📋 Next Steps:')
    console.log('   1. Check your email for alert notification')
    console.log('   2. Check GHL Contacts for "Balzan Cars"')
    console.log('   3. Check GHL Tasks for new task')
    console.log('   4. Check SMS if configured')
    console.log('   5. View alert in QuartzIQ: http://localhost:3069/dashboard/monitoring')
    console.log('')

    await pool.end()

  } catch (error) {
    console.error('❌ Error:', error)
    await pool.end()
    throw error
  }
}

createTestContactAndAlert()
