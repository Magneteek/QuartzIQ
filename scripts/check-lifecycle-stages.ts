/**
 * Check Lifecycle Stage Distribution
 * Shows why Lead Qualification page only shows 6 leads
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkLifecycleStages() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    console.log('📊 Checking lifecycle stage distribution...\n');

    // Get lifecycle stage counts
    const stagesResult = await pool.query(`
      SELECT
        COALESCE(lifecycle_stage, 'NULL') as lifecycle_stage,
        COUNT(*) as count
      FROM businesses
      GROUP BY lifecycle_stage
      ORDER BY count DESC
    `);

    console.log('🏢 Businesses by Lifecycle Stage:');
    console.log('─────────────────────────────────────');
    stagesResult.rows.forEach(row => {
      console.log(`  ${row.lifecycle_stage.padEnd(20)} ${row.count} businesses`);
    });

    // Get total
    const totalResult = await pool.query(`SELECT COUNT(*) as total FROM businesses`);
    console.log(`─────────────────────────────────────`);
    console.log(`  ${'TOTAL'.padEnd(20)} ${totalResult.rows[0].total} businesses`);

    console.log('\n');

    // Check how many have place_id
    const placeIdResult = await pool.query(`
      SELECT
        lifecycle_stage,
        COUNT(*) as total,
        COUNT(place_id) as with_place_id,
        COUNT(place_id) * 100.0 / COUNT(*) as percent_with_place_id
      FROM businesses
      GROUP BY lifecycle_stage
      ORDER BY total DESC
    `);

    console.log('📍 Place ID Coverage by Lifecycle Stage:');
    console.log('─────────────────────────────────────────────────────────');
    placeIdResult.rows.forEach(row => {
      const stage = row.lifecycle_stage || 'NULL';
      console.log(`  ${stage.padEnd(20)} ${row.with_place_id.toString().padStart(5)} / ${row.total.toString().padStart(5)} (${parseFloat(row.percent_with_place_id).toFixed(1)}%)`);
    });

    console.log('\n');

    // Check how many have reviews
    const reviewsResult = await pool.query(`
      SELECT
        b.lifecycle_stage,
        COUNT(DISTINCT b.id) as businesses,
        COUNT(r.id) as total_reviews,
        ROUND(AVG(CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) * 100, 1) as percent_with_reviews
      FROM businesses b
      LEFT JOIN reviews r ON r.business_id = b.id
      GROUP BY b.lifecycle_stage
      ORDER BY businesses DESC
    `);

    console.log('⭐ Review Coverage by Lifecycle Stage:');
    console.log('─────────────────────────────────────────────────────────');
    reviewsResult.rows.forEach(row => {
      const stage = row.lifecycle_stage || 'NULL';
      console.log(`  ${stage.padEnd(20)} ${row.businesses.toString().padStart(5)} businesses, ${row.total_reviews.toString().padStart(6)} reviews (${row.percent_with_reviews}% have reviews)`);
    });

    console.log('\n');

    // Show sample of businesses in each stage
    console.log('📋 Sample Businesses by Stage:');
    console.log('─────────────────────────────────────────────────────────\n');

    const samplesResult = await pool.query(`
      WITH ranked AS (
        SELECT
          id,
          name,
          lifecycle_stage,
          place_id IS NOT NULL as has_place_id,
          created_at,
          ROW_NUMBER() OVER (PARTITION BY lifecycle_stage ORDER BY created_at DESC) as rn
        FROM businesses
      )
      SELECT * FROM ranked WHERE rn <= 3
      ORDER BY lifecycle_stage, created_at DESC
    `);

    let currentStage = '';
    samplesResult.rows.forEach(row => {
      const stage = row.lifecycle_stage || 'NULL';
      if (stage !== currentStage) {
        console.log(`\n  ${stage} Stage:`);
        currentStage = stage;
      }
      const placeIcon = row.has_place_id ? '📍' : '❌';
      console.log(`    ${placeIcon} ${row.name}`);
      console.log(`       Created: ${new Date(row.created_at).toLocaleDateString()}`);
    });

    console.log('\n');
    console.log('💡 Key Insights:');
    console.log('─────────────────────────────────────────────────────────');
    console.log('  1. Lead Qualification page filters by lifecycle_stage = "lead"');
    console.log('  2. Most of your 5,000+ businesses are probably in a different stage');
    console.log('  3. To see all businesses, check what lifecycle_stage they have');
    console.log('  4. You may need to bulk update businesses to "lead" stage\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkLifecycleStages();
