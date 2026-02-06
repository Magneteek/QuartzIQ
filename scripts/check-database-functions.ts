/**
 * Check if required database functions exist
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkFunctions() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    console.log('🔍 Checking required database functions...\n');

    // Check for get_leads_for_va function
    const functionsCheck = await pool.query(`
      SELECT
        routine_name,
        routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN ('get_leads_for_va', 'get_lead_stats', 'log_lead_activity')
      ORDER BY routine_name;
    `);

    console.log('📋 Functions found:');
    functionsCheck.rows.forEach(row => {
      console.log(`  ✅ ${row.routine_name} (${row.routine_type})`);
    });

    const expectedFunctions = ['get_leads_for_va', 'get_lead_stats', 'log_lead_activity'];
    const foundFunctions = functionsCheck.rows.map(r => r.routine_name);
    const missingFunctions = expectedFunctions.filter(f => !foundFunctions.includes(f));

    if (missingFunctions.length > 0) {
      console.log('\n⚠️  Missing functions:');
      missingFunctions.forEach(f => {
        console.log(`  ❌ ${f}`);
      });
    } else {
      console.log('\n✅ All required functions exist!');
    }

    // Test get_leads_for_va
    if (foundFunctions.includes('get_leads_for_va')) {
      console.log('\n🧪 Testing get_leads_for_va function...');
      const testResult = await pool.query(
        'SELECT * FROM get_leads_for_va($1, $2, $3, $4, $5)',
        [5, 0, null, 'created_at', 'DESC']
      );
      console.log(`  ✅ Function works! Returned ${testResult.rows.length} rows`);

      if (testResult.rows.length > 0) {
        console.log('\n  Sample columns returned:');
        Object.keys(testResult.rows[0]).forEach(col => {
          console.log(`    - ${col}`);
        });
      }
    }

    // Test get_lead_stats
    if (foundFunctions.includes('get_lead_stats')) {
      console.log('\n🧪 Testing get_lead_stats function...');
      const statsResult = await pool.query('SELECT * FROM get_lead_stats()');
      console.log('  ✅ Stats:');
      const stats = statsResult.rows[0];
      console.log(`    - Total leads: ${stats.total_leads}`);
      console.log(`    - Ready for enrichment: ${stats.ready_for_enrichment}`);
      console.log(`    - Added today: ${stats.added_today}`);
      console.log(`    - Added this week: ${stats.added_this_week}`);
      console.log(`    - Average rating: ${stats.average_rating}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkFunctions();
