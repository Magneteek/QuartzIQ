/**
 * Check Enrichment Queue Status
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkQueue() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    console.log('📊 Checking enrichment queue status...\n');

    // Get queue status counts
    const statusResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM enrichment_queue
      GROUP BY status
      ORDER BY status
    `);

    console.log('📋 Queue Status:');
    console.log('─────────────────────────────────────');
    statusResult.rows.forEach(row => {
      console.log(`  ${row.status.padEnd(15)} ${row.count}`);
    });

    // Get pending queue details
    const queueResult = await pool.query(`
      SELECT
        eq.id as queue_id,
        eq.business_id,
        b.name as business_name,
        eq.status,
        eq.priority,
        eq.queued_at
      FROM enrichment_queue eq
      JOIN businesses b ON b.id = eq.business_id
      WHERE eq.status IN ('queued', 'processing', 'failed')
      ORDER BY eq.priority DESC, eq.queued_at ASC
    `);

    if (queueResult.rows.length > 0) {
      console.log('\n📝 Current Queue:');
      console.log('─────────────────────────────────────');
      queueResult.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.business_name}`);
        console.log(`     Queue ID: ${row.queue_id}`);
        console.log(`     Business ID: ${row.business_id}`);
        console.log(`     Status: ${row.status}`);
        console.log(`     Priority: ${row.priority}`);
        console.log(`     Queued: ${new Date(row.queued_at).toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('\n✅ Queue is empty');
    }

    // Get business enrichment status
    const businessResult = await pool.query(`
      SELECT
        lifecycle_stage,
        ready_for_enrichment,
        COUNT(*) as count
      FROM businesses
      WHERE lifecycle_stage IN ('lead', 'qualified')
      GROUP BY lifecycle_stage, ready_for_enrichment
      ORDER BY lifecycle_stage, ready_for_enrichment
    `);

    console.log('\n🏢 Business Enrichment Status:');
    console.log('─────────────────────────────────────');
    businessResult.rows.forEach(row => {
      const stage = row.lifecycle_stage;
      const ready = row.ready_for_enrichment ? 'ready' : 'not ready';
      console.log(`  ${stage} (${ready}): ${row.count}`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkQueue();
