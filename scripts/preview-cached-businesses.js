#!/usr/bin/env node
/**
 * PREVIEW CACHED BUSINESSES
 *
 * Shows what businesses are available in the cache for targeted review extraction
 * Use this to understand what you can extract before running the full extraction
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function previewCachedBusinesses() {
  console.log('\n🔍 PREVIEW CACHED BUSINESSES');
  console.log('═══════════════════════════════════════════════════════\n');

  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    const category = args[0] || 'tandarts';
    const city = args[1] || 'Amsterdam';
    const maxRating = args[2] ? parseFloat(args[2]) : 4.6;
    const limit = args[3] ? parseInt(args[3]) : 20;

    console.log(`📊 Query Parameters:`);
    console.log(`   Category: ${category}`);
    console.log(`   City: ${city}`);
    console.log(`   Max Rating: ${maxRating}`);
    console.log(`   Max results: ${limit}`);
    console.log(`\n💡 Usage: node preview-cached-businesses.js [category] [city] [maxRating] [limit]`);
    console.log(`   Example: node preview-cached-businesses.js tandarts Amsterdam 4.6 10\n`);

    // Query the database
    console.log('🔄 Querying database...\n');

    const result = await pool.query(`
      SELECT
        place_id,
        name,
        address,
        rating,
        reviews_count,
        category,
        last_scraped_at
      FROM businesses
      WHERE city ILIKE $1
        AND category ILIKE $2
        AND rating <= $3
      ORDER BY rating ASC, reviews_count DESC
      LIMIT $4
    `, [`%${city}%`, `%${category}%`, maxRating, limit]);

    if (result.rows.length === 0) {
      console.log('❌ No businesses found matching criteria');
      console.log('\n   Try different search terms:');
      console.log('   - tandarts (dentist)');
      console.log('   - fysiotherapeut (physiotherapist)');
      console.log('   - restaurant');
      console.log('   - hotel');
      return;
    }

    console.log(`✅ Found ${result.rows.length} cached businesses\n`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Display businesses
    result.rows.forEach((business, idx) => {
      console.log(`${idx + 1}. ${business.name}`);
      console.log(`   Rating: ⭐ ${business.rating || 'N/A'} | Reviews: ${business.reviews_count || 0}`);
      console.log(`   Address: ${business.address || 'N/A'}`);
      console.log(`   Place ID: ${business.place_id}`);
      console.log(`   Last scraped: ${business.last_scraped_at ? new Date(business.last_scraped_at).toLocaleDateString() : 'Never'}`);
      console.log();
    });

    // Summary statistics
    const avgRating = (result.rows.reduce((sum, b) => sum + (b.rating || 0), 0) / result.rows.length).toFixed(2);
    const totalReviews = result.rows.reduce((sum, b) => sum + (b.reviews_count || 0), 0);
    const lowRated = result.rows.filter(b => b.rating && b.rating <= 4.6).length;

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 STATISTICS:');
    console.log(`   Total businesses: ${result.rows.length}`);
    console.log(`   Average rating: ⭐ ${avgRating}`);
    console.log(`   Total reviews (combined): ${totalReviews}`);
    console.log(`   Businesses ≤4.6★: ${lowRated} (${((lowRated / result.rows.length) * 100).toFixed(1)}%)`);

    // Cost estimation
    const reviewExtractionCost = result.rows.length * 0.02;
    const fullExtractionCost = 0.05 + reviewExtractionCost;
    const savings = fullExtractionCost - reviewExtractionCost;

    console.log('\n💰 COST ESTIMATE:');
    console.log(`   Review extraction: $${reviewExtractionCost.toFixed(2)} (${result.rows.length} × $0.02)`);
    console.log(`   Full extraction: $${fullExtractionCost.toFixed(2)}`);
    console.log(`   💵 Savings by using cache: $${savings.toFixed(2)} (${((savings / fullExtractionCost) * 100).toFixed(1)}%)`);

    console.log('\n✅ NEXT STEP:');
    console.log(`   Run: node extract-reviews-from-cache.js category=${category} city=${city} businessLimit=${result.rows.length}`);
    console.log('\n═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  previewCachedBusinesses()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { previewCachedBusinesses };
