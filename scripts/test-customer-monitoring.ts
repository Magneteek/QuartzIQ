/**
 * Test Script: Customer Monitoring System
 * Tests all components of the customer monitoring system
 */

import { customerMonitoringService } from '../src/lib/services/customer-monitoring'
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

async function testCustomerMonitoring() {
  console.log('🧪 Testing Customer Monitoring System\n')

  try {
    // Test 1: Get monitoring stats
    console.log('📊 Test 1: Getting monitoring stats...')
    const stats = await customerMonitoringService.getStats()
    console.log('Stats:', stats)
    console.log('✅ Test 1 passed\n')

    // Test 2: Find a test business (or create one)
    console.log('🔍 Test 2: Finding test business...')
    let testBusiness = await pool.query(
      'SELECT * FROM businesses LIMIT 1'
    )

    if (testBusiness.rows.length === 0) {
      console.log('No businesses found. Creating test business...')
      const createResult = await pool.query(
        `INSERT INTO businesses (
          place_id, name, address, rating, reviews_count, category
        ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          'test-place-id-123',
          'Test Restaurant',
          '123 Test Street, Amsterdam',
          4.5,
          100,
          'restaurant'
        ]
      )
      testBusiness = createResult
    }

    const businessId = testBusiness.rows[0].id
    console.log('Test business ID:', businessId)
    console.log('✅ Test 2 passed\n')

    // Test 3: Update lifecycle stage
    console.log('🔄 Test 3: Updating lifecycle stage to customer...')
    await customerMonitoringService.updateLifecycleStage(
      businessId,
      'customer',
      true,
      'basic'
    )
    console.log('✅ Test 3 passed\n')

    // Test 4: Enable monitoring
    console.log('📡 Test 4: Enabling monitoring...')
    await customerMonitoringService.enableMonitoring(
      businessId,
      24, // Check every 24 hours
      3   // Alert on 3-star or below
    )
    console.log('✅ Test 4 passed\n')

    // Test 5: Check if customer needs monitoring
    console.log('🔍 Test 5: Checking if customer needs monitoring...')
    const customersForMonitoring = await pool.query(
      'SELECT * FROM get_customers_for_monitoring()'
    )
    console.log(`Found ${customersForMonitoring.rows.length} customers needing monitoring`)
    console.log('✅ Test 5 passed\n')

    // Test 6: Run monitoring cycle (THIS WILL ACTUALLY SCRAPE - COSTS MONEY)
    const shouldRunLive = process.env.RUN_LIVE_SCRAPING === 'true'

    if (shouldRunLive) {
      console.log('⚠️  Test 6: Running LIVE monitoring cycle (will cost money)...')
      const results = await customerMonitoringService.runMonitoringCycle()
      console.log('Monitoring results:', results)
      console.log('✅ Test 6 passed\n')
    } else {
      console.log('⏭️  Test 6: SKIPPED live monitoring (set RUN_LIVE_SCRAPING=true to run)\n')
    }

    // Test 7: Get alerts
    console.log('🚨 Test 7: Getting unacknowledged alerts...')
    const alerts = await customerMonitoringService.getUnacknowledgedAlerts(10)
    console.log(`Found ${alerts.length} unacknowledged alerts`)
    if (alerts.length > 0) {
      console.log('First alert:', alerts[0])
    }
    console.log('✅ Test 7 passed\n')

    // Test 8: Disable monitoring
    console.log('🛑 Test 8: Disabling monitoring...')
    await customerMonitoringService.disableMonitoring(businessId)
    console.log('✅ Test 8 passed\n')

    // Final stats
    console.log('📊 Final monitoring stats:')
    const finalStats = await customerMonitoringService.getStats()
    console.log(finalStats)

    console.log('\n✅ All tests passed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
    await customerMonitoringService.close()
  }
}

// Run tests
testCustomerMonitoring()
