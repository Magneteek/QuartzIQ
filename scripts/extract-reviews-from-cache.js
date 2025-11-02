#!/usr/bin/env node
/**
 * TARGETED REVIEW EXTRACTION FROM CACHED BUSINESSES
 *
 * This script is a COST-OPTIMIZED alternative to full extraction:
 * - Uses cached business listings (skip expensive "find businesses" step)
 * - Extracts reviews only from known place_ids
 * - Much cheaper: ~$0.02 per business vs $0.05-0.10 for full extraction
 *
 * Use Case: Amsterdam dentists already cached, now extract their latest reviews
 */

const { query } = require('./database/db.js');
const { UniversalBusinessReviewExtractor } = require('./src/lib/extractor.ts');
const { businessCache } = require('./src/lib/services/business-cache.ts');
const { reviewCache } = require('./src/lib/services/review-cache.ts');

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  // Search filters for cached businesses
  category: 'tandarts',           // Dutch for "dentist"
  city: 'Amsterdam',
  max_rating: 4.6,                // Only businesses with rating ≤ 4.6
  country_code: 'nl',

  // Review extraction settings
  maxReviewsPerBusiness: 10,      // Max reviews to extract per business
  maxReviewStars: 3,              // Only extract ≤ 3 star reviews
  dayLimit: 30,                   // Reviews from last 30 days
  language: 'nl',

  // Batch settings
  businessLimit: 10,              // How many businesses to process (start small for testing)
  batchSize: 5,                   // Process N businesses at a time
};

// ============================================================
// COST CALCULATIONS
// ============================================================

const COSTS = {
  findBusinesses: 0.05,           // Cost to search Google Maps for businesses
  extractReviews: 0.02,           // Cost to extract reviews from one business
};

function calculateCostSavings(businessCount) {
  const fullExtractionCost = (COSTS.findBusinesses + (COSTS.extractReviews * businessCount));
  const cachedExtractionCost = (COSTS.extractReviews * businessCount);
  const savings = fullExtractionCost - cachedExtractionCost;

  return {
    fullCost: fullExtractionCost.toFixed(2),
    cachedCost: cachedExtractionCost.toFixed(2),
    savings: savings.toFixed(2),
    savingsPercent: ((savings / fullExtractionCost) * 100).toFixed(1)
  };
}

// ============================================================
// MAIN EXTRACTION LOGIC
// ============================================================

async function extractReviewsFromCachedBusinesses() {
  console.log('\n🚀 TARGETED REVIEW EXTRACTION FROM CACHE');
  console.log('═══════════════════════════════════════════════════════\n');

  const startTime = Date.now();

  try {
    // --------------------------------------------------------
    // STEP 1: Query cached businesses from database
    // --------------------------------------------------------
    console.log('📊 STEP 1: Querying cached businesses from database...\n');
    console.log(`   Category: ${CONFIG.category}`);
    console.log(`   City: ${CONFIG.city}`);
    console.log(`   Max Rating: ${CONFIG.max_rating}`);
    console.log(`   Limit: ${CONFIG.businessLimit}`);

    const cachedBusinesses = await businessCache.searchCached({
      category: CONFIG.category,
      city: CONFIG.city,
      max_rating: CONFIG.max_rating,
      country_code: CONFIG.country_code,
      limit: CONFIG.businessLimit
    });

    if (cachedBusinesses.length === 0) {
      console.log('\n❌ No cached businesses found matching criteria');
      console.log('   Try adjusting filters or run full extraction first');
      return;
    }

    console.log(`\n✅ Found ${cachedBusinesses.length} cached businesses`);

    // Show cost comparison
    const costAnalysis = calculateCostSavings(cachedBusinesses.length);
    console.log('\n💰 COST ANALYSIS:');
    console.log(`   Full extraction (find + reviews): $${costAnalysis.fullCost}`);
    console.log(`   Cached extraction (reviews only): $${costAnalysis.cachedCost}`);
    console.log(`   💵 SAVINGS: $${costAnalysis.savings} (${costAnalysis.savingsPercent}%)`);

    // --------------------------------------------------------
    // STEP 2: Extract reviews from each business
    // --------------------------------------------------------
    console.log('\n\n📍 STEP 2: Extracting reviews from businesses...\n');

    const extractor = new UniversalBusinessReviewExtractor();
    const results = {
      totalBusinesses: cachedBusinesses.length,
      processedBusinesses: 0,
      totalReviews: 0,
      negativeReviews: 0,
      cachedReviews: 0,
      newReviews: 0,
      errors: [],
      businesses: []
    };

    // Process businesses in batches
    for (let i = 0; i < cachedBusinesses.length; i += CONFIG.batchSize) {
      const batch = cachedBusinesses.slice(i, i + CONFIG.batchSize);
      console.log(`\n📦 Processing batch ${Math.floor(i / CONFIG.batchSize) + 1} (${batch.length} businesses)...\n`);

      for (const business of batch) {
        try {
          console.log(`   📍 ${business.name}`);
          console.log(`      Rating: ⭐ ${business.rating} | Reviews: ${business.reviews_count}`);
          console.log(`      Place ID: ${business.place_id}`);

          // Check cache first
          const cachedReviews = await reviewCache.getReviewsForBusiness(
            business.place_id,
            {
              maxStars: CONFIG.maxReviewStars,
              dayLimit: CONFIG.dayLimit
            }
          );

          if (cachedReviews.length > 0) {
            console.log(`      💾 Found ${cachedReviews.length} cached reviews`);
            results.cachedReviews += cachedReviews.length;
            results.totalReviews += cachedReviews.length;
            results.negativeReviews += cachedReviews.filter(r => r.rating <= CONFIG.maxReviewStars).length;
          }

          // Extract fresh reviews from Apify
          console.log(`      🔄 Extracting fresh reviews from Apify...`);

          const freshReviews = await extractor.extractReviewsFromBusiness(
            {
              placeId: business.place_id,
              title: business.name,
              address: business.address || '',
              totalScore: business.rating || 0,
              reviewsCount: business.reviews_count || 0
            },
            {
              category: CONFIG.category,
              location: CONFIG.city,
              maxReviewsPerBusiness: CONFIG.maxReviewsPerBusiness,
              maxStars: CONFIG.maxReviewStars,
              dayLimit: CONFIG.dayLimit,
              language: CONFIG.language
            }
          );

          console.log(`      ✅ Extracted ${freshReviews.length} reviews`);

          // Filter negative reviews
          const negativeReviews = freshReviews.filter(r => r.stars <= CONFIG.maxReviewStars);
          console.log(`      ⭐ ${negativeReviews.length} negative reviews (≤${CONFIG.maxReviewStars} stars)`);

          // Cache the new reviews
          if (freshReviews.length > 0) {
            console.log(`      💾 Caching reviews in database...`);
            await reviewCache.cacheReviews(business.place_id, freshReviews);
            results.newReviews += freshReviews.length;
          }

          results.totalReviews += freshReviews.length;
          results.negativeReviews += negativeReviews.length;
          results.processedBusinesses++;

          results.businesses.push({
            name: business.name,
            place_id: business.place_id,
            rating: business.rating,
            reviews_extracted: freshReviews.length,
            negative_reviews: negativeReviews.length,
            cached_reviews: cachedReviews.length
          });

        } catch (error) {
          console.log(`      ❌ Error: ${error.message}`);
          results.errors.push({
            business: business.name,
            error: error.message
          });
        }
      }

      // Brief pause between batches to avoid rate limiting
      if (i + CONFIG.batchSize < cachedBusinesses.length) {
        console.log('\n   ⏸️  Pausing 2 seconds between batches...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // --------------------------------------------------------
    // STEP 3: Display final results
    // --------------------------------------------------------
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('✅ EXTRACTION COMPLETE');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📊 SUMMARY:');
    console.log(`   Businesses processed: ${results.processedBusinesses}/${results.totalBusinesses}`);
    console.log(`   Total reviews extracted: ${results.totalReviews}`);
    console.log(`   Negative reviews (≤${CONFIG.maxReviewStars}★): ${results.negativeReviews}`);
    console.log(`   Cached reviews used: ${results.cachedReviews}`);
    console.log(`   New reviews fetched: ${results.newReviews}`);
    console.log(`   Errors: ${results.errors.length}`);
    console.log(`   Duration: ${duration}s`);

    console.log('\n💰 COST BREAKDOWN:');
    console.log(`   Business search: $0.00 (used cache! 🎉)`);
    console.log(`   Review extraction: $${(results.processedBusinesses * COSTS.extractReviews).toFixed(2)}`);
    console.log(`   Total cost: $${(results.processedBusinesses * COSTS.extractReviews).toFixed(2)}`);
    console.log(`   💵 Saved: $${costAnalysis.savings} vs full extraction`);

    if (results.businesses.length > 0) {
      console.log('\n📋 BUSINESS DETAILS:');
      results.businesses.forEach((b, idx) => {
        console.log(`\n   ${idx + 1}. ${b.name}`);
        console.log(`      Rating: ⭐ ${b.rating}`);
        console.log(`      Reviews extracted: ${b.reviews_extracted}`);
        console.log(`      Negative reviews: ${b.negative_reviews}`);
        console.log(`      Cached reviews: ${b.cached_reviews}`);
      });
    }

    if (results.errors.length > 0) {
      console.log('\n\n⚠️  ERRORS:');
      results.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.business}: ${err.error}`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════\n');

    // Return results for programmatic use
    return results;

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    console.error(error.stack);
    throw error;
  }
}

// ============================================================
// CLI INTERFACE
// ============================================================

if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);

  // Allow overriding config via CLI
  args.forEach(arg => {
    const [key, value] = arg.split('=');
    if (key && value && CONFIG.hasOwnProperty(key)) {
      CONFIG[key] = isNaN(value) ? value : Number(value);
    }
  });

  // Show configuration
  console.log('\n⚙️  CONFIGURATION:');
  console.log(JSON.stringify(CONFIG, null, 2));
  console.log('\n💡 TIP: Override settings with: node extract-reviews-from-cache.js businessLimit=20\n');

  // Run extraction
  extractReviewsFromCachedBusinesses()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { extractReviewsFromCachedBusinesses, CONFIG };
