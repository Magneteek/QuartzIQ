/**
 * Cleanup Duplicate Queue Entries
 * Removes duplicate entries from enrichment_queue
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function cleanupDuplicates() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    console.log('🔍 Checking for duplicate queue entries...\n');

    // Find duplicates
    const duplicates = await pool.query(`
      SELECT business_id, COUNT(*) as count
      FROM enrichment_queue
      WHERE status IN ('queued', 'failed')
      GROUP BY business_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);

    if (duplicates.rows.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    console.log(`❌ Found ${duplicates.rows.length} businesses with duplicate entries:\n`);

    let totalDuplicates = 0;
    duplicates.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. Business ${row.business_id}: ${row.count} entries`);
      totalDuplicates += parseInt(row.count) - 1; // Count extras
    });

    console.log(`\n📊 Total duplicate entries to remove: ${totalDuplicates}\n`);

    // Ask for confirmation (auto-yes for script)
    console.log('🗑️  Removing duplicates (keeping oldest entry per business)...\n');

    // Delete duplicates, keeping only the oldest entry per business
    const result = await pool.query(`
      DELETE FROM enrichment_queue
      WHERE id IN (
        SELECT id
        FROM (
          SELECT
            id,
            business_id,
            ROW_NUMBER() OVER (
              PARTITION BY business_id
              ORDER BY queued_at ASC  -- Keep the oldest one
            ) as row_num
          FROM enrichment_queue
          WHERE status IN ('queued', 'failed')
        ) ranked
        WHERE row_num > 1  -- Delete all but the first one
      )
    `);

    console.log(`✅ Removed ${result.rowCount} duplicate entries`);

    // Show remaining queue
    const remaining = await pool.query(`
      SELECT COUNT(*) as count
      FROM enrichment_queue
      WHERE status IN ('queued', 'failed')
    `);

    console.log(`\n📋 Remaining queue items: ${remaining.rows[0].count}`);

    // Show what's left
    const queue = await pool.query(`
      SELECT
        eq.id,
        b.name as business_name,
        eq.status,
        eq.queued_at
      FROM enrichment_queue eq
      JOIN businesses b ON b.id = eq.business_id
      WHERE eq.status IN ('queued', 'failed')
      ORDER BY eq.priority DESC, eq.queued_at ASC
      LIMIT 10
    `);

    if (queue.rows.length > 0) {
      console.log('\n📋 Current queue:');
      queue.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.business_name} - ${row.status} (queued: ${new Date(row.queued_at).toLocaleString()})`);
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

cleanupDuplicates();
