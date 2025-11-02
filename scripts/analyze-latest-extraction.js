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

async function analyzeLatestExtraction() {
  console.log('\n📊 LATEST EXTRACTION ANALYSIS');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Get most recent reviews
    const latestReview = await pool.query(`
      SELECT extracted_at, business_id
      FROM reviews
      ORDER BY extracted_at DESC
      LIMIT 1
    `);

    if (latestReview.rows.length === 0) {
      console.log('❌ No reviews found in database');
      await pool.end();
      return;
    }

    const latestTime = latestReview.rows[0].extracted_at;
    console.log(`🕐 Most recent extraction: ${latestTime}`);

    // Get all reviews from the latest extraction (within 10 minutes)
    const cutoffTime = new Date(new Date(latestTime).getTime() - 10 * 60 * 1000);

    const reviewsResult = await pool.query(`
      SELECT
        r.id,
        r.business_id,
        r.rating,
        r.text,
        r.published_date,
        r.extracted_at,
        b.name as business_name,
        b.category,
        b.city,
        b.place_id,
        b.first_discovered_at
      FROM reviews r
      LEFT JOIN businesses b ON r.business_id = b.id
      WHERE r.extracted_at >= $1
      ORDER BY r.extracted_at DESC
    `, [cutoffTime]);

    console.log(`\n📋 Latest Extraction Results:`);
    console.log(`─────────────────────────────────────────`);
    console.log(`Total reviews: ${reviewsResult.rows.length}`);

    // Get unique businesses
    const businesses = new Map();
    reviewsResult.rows.forEach(review => {
      const name = review.business_name || `Business ID: ${review.business_id}`;
      if (!businesses.has(name)) {
        businesses.set(name, {
          name,
          category: review.category,
          city: review.city,
          placeId: review.place_id,
          firstDiscovered: review.first_discovered_at,
          reviews: []
        });
      }
      businesses.get(name).reviews.push(review);
    });

    console.log(`Unique businesses: ${businesses.size}`);

    // Infer extraction parameters from first business
    if (businesses.size > 0) {
      const firstBusiness = Array.from(businesses.values())[0];
      console.log('\n🔍 Extraction Parameters:');
      console.log(`─────────────────────────────────────────`);
      console.log(`Category: ${firstBusiness.category || 'Unknown'}`);
      console.log(`Location: ${firstBusiness.city || 'Unknown'}`);

      const ratings = reviewsResult.rows.map(r => r.rating);
      const maxRating = Math.max(...ratings);
      console.log(`Max Review Stars: ≤${maxRating}`);

      // Check date range
      const dates = reviewsResult.rows.map(r => new Date(r.published_date)).filter(d => !isNaN(d));
      if (dates.length > 0) {
        const oldestReview = new Date(Math.min(...dates));
        const daysDiff = Math.floor((Date.now() - oldestReview.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`Time Window: ~${daysDiff} days (oldest review)`);
      }
      console.log(`Business Limit: ${businesses.size} (actual processed)`);
    }

    // Cache analysis
    console.log('\n\n💾 Cache vs Crawl Analysis:');
    console.log(`─────────────────────────────────────────`);

    let cachedCount = 0;
    let crawledCount = 0;

    for (const [name, data] of businesses) {
      if (data.placeId) {
        // Check if this business existed before this extraction
        const cacheCheck = await pool.query(`
          SELECT first_discovered_at FROM businesses
          WHERE place_id = $1
          LIMIT 1
        `, [data.placeId]);

        if (cacheCheck.rows.length > 0) {
          const businessCreated = new Date(cacheCheck.rows[0].first_discovered_at);
          const extractionTime = new Date(latestTime);

          if (businessCreated < new Date(extractionTime.getTime() - 60000)) {
            // Business was created more than 1 minute before extraction = cached
            cachedCount++;
          } else {
            // Business created around extraction time = newly crawled
            crawledCount++;
          }
        } else {
          crawledCount++;
        }
      }
    }

    console.log(`📦 From cache: ${cachedCount} businesses`);
    console.log(`🔍 Newly crawled: ${crawledCount} businesses`);

    if (cachedCount + crawledCount > 0) {
      const cachePercent = (cachedCount / (cachedCount + crawledCount)) * 100;
      console.log(`📊 Cache hit rate: ${cachePercent.toFixed(1)}%`);

      const estimatedCost = crawledCount * 0.004;
      const potentialCost = (cachedCount + crawledCount) * 0.004;
      const savings = potentialCost - estimatedCost;

      console.log(`\n💰 Cost Analysis:`);
      console.log(`   Actual cost: $${estimatedCost.toFixed(3)} (${crawledCount} crawled)`);
      console.log(`   Full cost would be: $${potentialCost.toFixed(3)} (if all crawled)`);
      console.log(`   💵 Saved: $${savings.toFixed(3)} (${((savings / potentialCost) * 100).toFixed(1)}%)`);
    }

    // Show top businesses
    console.log('\n\n📊 Top Businesses by Review Count:');
    console.log(`─────────────────────────────────────────`);

    const sorted = Array.from(businesses.entries())
      .sort((a, b) => b[1].reviews.length - a[1].reviews.length)
      .slice(0, 10);

    sorted.forEach(([name, data], i) => {
      const avgRating = data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length;
      const cached = data.placeId ? '💾' : '🔍';
      console.log(`  ${i + 1}. ${cached} ${name}: ${data.reviews.length} reviews (avg: ${avgRating.toFixed(1)}⭐)`);
    });

    // Show sample reviews
    console.log('\n\n📝 Sample Reviews:');
    console.log(`─────────────────────────────────────────`);
    reviewsResult.rows.slice(0, 3).forEach((review, i) => {
      const name = review.business_name || review.business_title || 'Unknown';
      console.log(`\n${i + 1}. ${name} (${review.rating}⭐)`);
      console.log(`   "${review.text?.substring(0, 100)}${review.text?.length > 100 ? '...' : ''}"`);
      console.log(`   Published: ${review.published_date}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

analyzeLatestExtraction();
