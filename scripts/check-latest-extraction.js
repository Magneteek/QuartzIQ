#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function checkLatestExtraction() {
  console.log('\n📊 LATEST EXTRACTION ANALYSIS');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Get latest extraction
    const extractionResult = await pool.query(`
      SELECT
        extraction_id,
        category,
        location,
        business_limit,
        max_review_stars,
        day_limit,
        started_at,
        completed_at,
        status
      FROM extractions
      ORDER BY started_at DESC
      LIMIT 1
    `);

    if (extractionResult.rows.length === 0) {
      console.log('❌ No extractions found in database');
      await pool.end();
      return;
    }

    const extraction = extractionResult.rows[0];

    console.log('🔍 Extraction Parameters:');
    console.log('─────────────────────────');
    console.log(`Extraction ID: ${extraction.extraction_id}`);
    console.log(`Category: ${extraction.category}`);
    console.log(`Location: ${extraction.location}`);
    console.log(`Business Limit: ${extraction.business_limit}`);
    console.log(`Max Review Stars: ${extraction.max_review_stars}`);
    console.log(`Day Limit: ${extraction.day_limit} days`);
    console.log(`Started: ${extraction.started_at}`);
    console.log(`Completed: ${extraction.completed_at || 'In progress...'}`);
    console.log(`Status: ${extraction.status}`);

    // Check how many businesses were cached vs crawled
    console.log('\n\n💾 Cache vs Crawl Analysis:');
    console.log('─────────────────────────');

    // Count cached businesses for this category/location
    const cacheQuery = `
      SELECT COUNT(*) as cached_count
      FROM businesses
      WHERE
        (LOWER(category) LIKE LOWER($1) OR LOWER(category) LIKE LOWER($2))
        AND (LOWER(city) LIKE LOWER($3) OR LOWER(address) LIKE LOWER($3))
    `;

    const cacheResult = await pool.query(cacheQuery, [
      `%${extraction.category}%`,
      extraction.category,
      `%${extraction.location}%`
    ]);

    const cachedCount = parseInt(cacheResult.rows[0].cached_count);
    console.log(`📦 Businesses in cache: ${cachedCount}`);
    console.log(`🎯 Requested limit: ${extraction.business_limit}`);

    if (cachedCount >= extraction.business_limit) {
      console.log(`✅ CACHE SUFFICIENT: Used ${extraction.business_limit} from cache`);
      console.log(`💰 Cost: $0 (100% from cache)`);
    } else if (cachedCount > 0) {
      const needed = extraction.business_limit - cachedCount;
      console.log(`🔀 HYBRID MODE: ${cachedCount} from cache + ${needed} crawled`);
      console.log(`💰 Estimated cost: $${(needed * 0.004).toFixed(2)} (crawled only)`);
    } else {
      console.log(`🔍 SEARCH MODE: All ${extraction.business_limit} crawled from Google Maps`);
      console.log(`💰 Estimated cost: $${(extraction.business_limit * 0.004).toFixed(2)}`);
    }

    // Get actual reviews extracted
    console.log('\n\n📋 Extraction Results:');
    console.log('─────────────────────────');

    const reviewsResult = await pool.query(`
      SELECT
        business_name,
        COUNT(*) as review_count,
        AVG(rating) as avg_rating
      FROM reviews
      WHERE extraction_id = $1
      GROUP BY business_name
      ORDER BY review_count DESC
      LIMIT 10
    `, [extraction.extraction_id]);

    const totalReviews = await pool.query(`
      SELECT COUNT(*) as total FROM reviews WHERE extraction_id = $1
    `, [extraction.extraction_id]);

    console.log(`📊 Total reviews extracted: ${totalReviews.rows[0].total}`);
    console.log(`🏢 Businesses with reviews: ${reviewsResult.rows.length}`);

    if (reviewsResult.rows.length > 0) {
      console.log('\nTop businesses by review count:');
      reviewsResult.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.business_name || 'Unknown'}: ${row.review_count} reviews (avg: ${parseFloat(row.avg_rating).toFixed(1)}⭐)`);
      });
    }

    // Check if we have Apify run information in logs
    console.log('\n\n🔍 Checking Apify Run Logs...');
    console.log('─────────────────────────');

    // Try to find Apify run IDs from recent console output
    // This would need to be enhanced to store run IDs in database

    console.log('ℹ️  For detailed Apify run info, check:');
    console.log('   https://console.apify.com/actors/runs');
    console.log(`   Filter by time: ${extraction.started_at}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkLatestExtraction();
