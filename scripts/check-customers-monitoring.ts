#!/usr/bin/env tsx

import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

async function checkCustomers() {
  try {
    console.log('🔍 Checking customers marked for monitoring...\n')

    // Check all customers
    const customersResult = await pool.query(`
      SELECT
        id,
        name,
        lifecycle_stage,
        is_paying_customer,
        monitoring_enabled,
        place_id,
        monitoring_frequency_hours,
        next_monitoring_check,
        last_monitoring_check
      FROM businesses
      WHERE lifecycle_stage = 'customer'
      ORDER BY name
    `)

    console.log(`Found ${customersResult.rows.length} customers:\n`)

    for (const customer of customersResult.rows) {
      console.log('─'.repeat(80))
      console.log(`📊 ${customer.name}`)
      console.log(`   ID: ${customer.id}`)
      console.log(`   Lifecycle: ${customer.lifecycle_stage}`)
      console.log(`   Paying Customer: ${customer.is_paying_customer}`)
      console.log(`   Monitoring Enabled: ${customer.monitoring_enabled}`)
      console.log(`   Place ID: ${customer.place_id || '❌ MISSING'}`)
      console.log(`   Frequency: ${customer.monitoring_frequency_hours} hours`)
      console.log(`   Last Check: ${customer.last_monitoring_check || 'Never'}`)
      console.log(`   Next Check: ${customer.next_monitoring_check || '❌ NOT SCHEDULED'}`)

      // Check if due for monitoring
      const isDue = !customer.next_monitoring_check || new Date(customer.next_monitoring_check) <= new Date()
      console.log(`   ✓ Due for Monitoring: ${isDue ? '✅ YES' : '❌ NO (scheduled for future)'}`)
      console.log('')
    }

    // Check what get_customers_for_monitoring() returns
    console.log('\n🔍 Checking get_customers_for_monitoring() function...\n')

    const monitoringResult = await pool.query(`
      SELECT * FROM get_customers_for_monitoring(NOW())
    `)

    console.log(`Function returned ${monitoringResult.rows.length} customers:\n`)

    if (monitoringResult.rows.length === 0) {
      console.log('❌ No customers returned by monitoring function!')
      console.log('\nPossible reasons:')
      console.log('1. next_monitoring_check is in the future')
      console.log('2. monitoring_enabled = false')
      console.log('3. is_paying_customer = false')
      console.log('4. place_id is NULL')
    } else {
      for (const customer of monitoringResult.rows) {
        console.log(`✅ ${customer.business_name} (${customer.business_id})`)
        console.log(`   Place ID: ${customer.place_id}`)
        console.log(`   Last Checked: ${customer.last_checked || 'Never'}`)
        console.log(`   Frequency: ${customer.frequency_hours} hours`)
        console.log('')
      }
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await pool.end()
  }
}

checkCustomers()
