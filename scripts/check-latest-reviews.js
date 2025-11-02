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

async function checkLatestReviews() {
  console.log('\n📊 LATEST EXTRACTION ANALYSIS');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Get most recent reviews to understand the extraction
    const latestReview = await pool.query(`
      SELECT created_at
      FROM reviews
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (latestReview.rows.length === 0) {
      console.log('❌ No reviews found in database');
      await pool.end();
      return;
    }

    const latestTime = latestReview.rows[0].created_at;
    console.log(`🕐 Most recent extraction: ${latestTime}`);

    // Get all reviews from the latest extraction (within 5 minutes)
    const cutoffTime = new Date(new Date(latestTime).getTime() - 5 * 60 * 1000);

    const reviewsResult = await pool.query(`
      SELECT
        business_name,
        rating,
        text,
        published_at,
        created_at
      FROM reviews
      WHERE created_at >= $1
      ORDER BY created_at DESC
    `, [cutoffTime]);

    console.log(`\n📋 Reviews from Latest Extraction:`);
    console.log(`─────────────────────────────────────────`);
    console.log(`Total reviews: ${reviewsResult.rows.length}`);

    // Group by business
    const byBusiness = {};
    reviewsResult.rows.forEach(review => {
      const name = review.business_name || 'Unknown Business';
      if (!byBusiness[name]) {
        byBusiness[name] = [];
      }
      byBusiness[name].push(review);
    });

    console.log(`Unique businesses: ${Object.keys(byBusiness).length}`);

    // Show breakdown
    console.log('\n📊 Reviews by Business:');
    Object.entries(byBusiness)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .forEach(([name, reviews]) => {
        const avgRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length;
        console.log(`  • ${name}: ${reviews.length} reviews (avg: ${avgRating.toFixed(1)}⭐)`);
      });

    // Get extraction parameters from the first review's business
    if (reviewsResult.rows.length > 0) {
      const firstBusinessName = reviewsResult.rows[0].business_name;

      // Try to find the business in cache
      const businessResult = await pool.query(`
        SELECT category, city, rating, reviews_count
        FROM businesses
        WHERE name = $1 OR title = $1
        LIMIT 1
      `, [firstBusinessName]);

      if (businessResult.rows.length > 0) {
        const business = businessResult.rows[0];
        console.log('\n\n🔍 Extraction Parameters (inferred):');
        console.log(`─────────────────────────────────────────`);
        console.log(`Category: ${business.category || 'Unknown'}`);
        console.log(`Location: ${business.city || 'Unknown'}`);
        console.log(`Max Review Stars: ≤3 (based on results)`);
      }
    }

    // Check cache status
    if (reviewsResult.rows.length > 0) {
      const businessNames = [...new Set(reviewsResult.rows.map(r => r.business_name))];

      console.log('\n\n💾 Cache Analysis:');
      console.log(`─────────────────────────────────────────`);

      let cachedCount = 0;
      for (const name of businessNames) {
        const cacheCheck = await pool.query(`
          SELECT place_id FROM businesses WHERE name = $1 OR title = $1 LIMIT 1
        `, [name]);

        if (cacheCheck.rows.length > 0) {
          cachedCount++;
        }
      }

      console.log(`Businesses in cache: ${cachedCount}/${businessNames.length}`);
      console.log(`Cache hit rate: ${((cachedCount / businessNames.length) * 100).toFixed(1)}%`);

      if (cachedCount === businessNames.length) {
        console.log(`✅ All businesses were from cache!`);
        console.log(`💰 Cost: $0 (100% cache usage)`);
      } else {
        const newBusinesses = businessNames.length - cachedCount;
        console.log(`🔀 Mixed: ${cachedCount} from cache, ${newBusinesses} newly crawled`);
        console.log(`💰 Estimated cost: $${(newBusinesses * 0.004).toFixed(3)}`);
      }
    }

    // Show sample reviews
    console.log('\n\n📝 Sample Reviews:');
    console.log(`─────────────────────────────────────────`);
    reviewsResult.rows.slice(0, 3).forEach((review, i) => {
      console.log(`\n${i + 1}. ${review.business_name || 'Unknown'} (${review.rating}⭐)`);
      console.log(`   "${review.text?.substring(0, 100)}${review.text?.length > 100 ? '...' : ''}"`);
      console.log(`   Published: ${review.published_at}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkLatestReviews();
