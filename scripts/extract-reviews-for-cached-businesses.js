/**
 * Extract Reviews for Cached Businesses
 *
 * This script runs review qualification on businesses already cached in the database.
 * It's useful after importing Apify datasets or when you want to re-extract reviews
 * for existing businesses.
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const API_KEY = 'quartziq_1236e22634e48db6b08754f0a6dd5f40dac1a28cb8067fdbf2e0faaee86ffae5';
const API_URL = 'http://localhost:3000/api/extract-optimized';

// Default criteria for review extraction
const DEFAULT_CRITERIA = {
  maxReviewStars: 3,        // Only reviews with 3 stars or less
  dayLimit: 14,              // Reviews from last 14 days
  maxReviewsPerBusiness: 5   // Max 5 reviews per business
};

console.log('============================================================');
console.log('     REVIEW EXTRACTION FOR CACHED BUSINESSES');
console.log('============================================================\n');

async function extractReviews(placeIds, criteria = {}) {
  const extractionCriteria = { ...DEFAULT_CRITERIA, ...criteria };

  console.log('📋 Extraction Criteria:');
  console.log('────────────────────────────────────────────────────────────');
  console.log(`   Max Review Stars: ≤ ${extractionCriteria.maxReviewStars} ⭐`);
  console.log(`   Time Window: Last ${extractionCriteria.dayLimit} days`);
  console.log(`   Max Reviews/Business: ${extractionCriteria.maxReviewsPerBusiness}`);
  console.log(`   Businesses to Process: ${placeIds.length}`);
  console.log('────────────────────────────────────────────────────────────\n');

  console.log('🚀 Starting Review Extraction...\n');
  console.log('⏳ This will take approximately 3-5 minutes for 400+ businesses');
  console.log('   (The API uses smart crawling to optimize speed)\n');

  const startTime = Date.now();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        // Use place IDs directly - API will pull from cache
        placeIds: placeIds.join(','),
        maxReviewStars: extractionCriteria.maxReviewStars,
        dayLimit: extractionCriteria.dayLimit,
        maxReviewsPerBusiness: extractionCriteria.maxReviewsPerBusiness,
        countryCode: 'nl',
        language: 'nl',
        // Required by API (even though we're using cached place IDs)
        category: 'insurance',  // Generic category
        location: 'Netherlands'  // Will use cached businesses anyway
      })
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`\n❌ Extraction Failed (${response.status})`);
      console.log(`   Error: ${errorText}\n`);
      return null;
    }

    const result = await response.json();

    console.log('\n✅ EXTRACTION COMPLETE!');
    console.log('============================================================');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📍 Extraction ID: ${result.extractionId || 'N/A'}`);
    console.log('============================================================\n');

    console.log('📊 RESULTS SUMMARY:');
    console.log('────────────────────────────────────────────────────────────');
    console.log(`   Businesses Processed: ${result.businesses?.total || 0}`);
    console.log(`   └─ From Cache: ${result.businesses?.cached || 0}`);
    console.log(`   └─ New: ${result.businesses?.new || 0}`);
    console.log('');
    console.log(`   Reviews Found: ${result.reviews?.total || 0}`);
    console.log(`   └─ Qualifying Reviews: ${result.reviews?.new || 0}`);
    console.log(`   └─ Already Extracted: ${result.reviews?.cached || 0}`);
    console.log('────────────────────────────────────────────────────────────\n');

    if (result.reviews?.total > 0) {
      console.log('🎯 QUALIFYING REVIEWS BREAKDOWN:');
      console.log('────────────────────────────────────────────────────────────');

      // Show star distribution
      const starCounts = { 1: 0, 2: 0, 3: 0 };
      if (result.reviews?.list) {
        result.reviews.list.forEach(review => {
          if (review.stars <= 3) {
            starCounts[review.stars] = (starCounts[review.stars] || 0) + 1;
          }
        });
      }

      console.log(`   ⭐ 1-Star Reviews: ${starCounts[1] || 0}`);
      console.log(`   ⭐⭐ 2-Star Reviews: ${starCounts[2] || 0}`);
      console.log(`   ⭐⭐⭐ 3-Star Reviews: ${starCounts[3] || 0}`);
      console.log('────────────────────────────────────────────────────────────\n');

      console.log('💰 COST INFORMATION:');
      console.log('────────────────────────────────────────────────────────────');
      console.log(`   Apify Credits Used: ${result.cost?.apifyCredits || 0}`);
      console.log(`   Total Cost: $${result.cost?.total || 0}`);
      console.log(`   Savings (from cache): $${result.cost?.savings || 0}`);
      console.log('────────────────────────────────────────────────────────────\n');
    }

    if (result.reviews?.total === 0) {
      console.log('ℹ️  NO QUALIFYING REVIEWS FOUND');
      console.log('────────────────────────────────────────────────────────────');
      console.log('   Possible reasons:');
      console.log('   • No reviews match the criteria (≤3 stars, last 14 days)');
      console.log('   • Reviews were already extracted previously');
      console.log('   • Businesses have no recent reviews');
      console.log('────────────────────────────────────────────────────────────\n');
    }

    console.log('📂 VIEW RESULTS:');
    console.log('────────────────────────────────────────────────────────────');
    console.log('   1. Open dashboard: http://localhost:3000');
    console.log('   2. Click "Contact Vault"');
    console.log('   3. Find extraction by ID or timestamp');
    console.log('   4. Export qualifying businesses to CRM');
    console.log('────────────────────────────────────────────────────────────\n');

    return result;

  } catch (error) {
    console.error('\n❌ Error during extraction:', error.message);
    console.error('   Stack:', error.stack);
    return null;
  }
}

async function main() {
  // Load place IDs from file
  const placeIdsFile = path.join(__dirname, '..', 'data', 'place-ids-for-review-crawl.json');

  if (!fs.existsSync(placeIdsFile)) {
    console.log('❌ Place IDs file not found!');
    console.log(`   Expected: ${placeIdsFile}`);
    console.log('\n   Run the import script first to generate place IDs.\n');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(placeIdsFile, 'utf8'));
  const placeIds = data.placeIds;

  console.log(`✅ Loaded ${placeIds.length} place IDs from file\n`);

  // Extract reviews
  const result = await extractReviews(placeIds);

  if (!result) {
    console.log('\n❌ Extraction failed. Please check the logs above.\n');
    process.exit(1);
  }

  // Save detailed results
  const resultsFile = path.join(__dirname, '..', 'data', 'extraction-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(result, null, 2));
  console.log(`💾 Detailed results saved to: extraction-results.json\n`);

  console.log('✅ ALL DONE!\n');
}

main().catch(error => {
  console.error('\n❌ Fatal Error:', error);
  process.exit(1);
});
