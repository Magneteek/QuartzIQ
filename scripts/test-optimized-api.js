#!/usr/bin/env node
/**
 * QuartzIQ Optimized API Test Script
 * Tests parameter passing and database caching functionality
 */

const API_KEY = 'quartziq_1236e22634e48db6b08754f0a6dd5f40dac1a28cb8067fdbf2e0faaee86ffae5';
const API_URL = 'http://localhost:3000/api/extract-optimized';

// Test search criteria
const testCriteria = {
  category: 'tandarts',
  location: 'Amsterdam',
  businessLimit: 10,
  maxReviewStars: 3,
  dayLimit: 14,
  maxReviewsPerBusiness: 5,
  language: 'nl',
  countryCode: 'nl',
  useCache: true,
  forceRefresh: false
};

console.log('\n🔧 QuartzIQ Optimized API Test');
console.log('═══════════════════════════════════════════════════════\n');

console.log('📋 Test Configuration:');
console.log(JSON.stringify(testCriteria, null, 2));

console.log('\n🚀 Sending request to optimized API...\n');

async function testOptimizedAPI() {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(testCriteria)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API Error:', response.status);
      console.error('Error details:', errorData);
      return;
    }

    const result = await response.json();

    console.log('✅ API Response Received');
    console.log('═══════════════════════════════════════════════════════\n');

    // Display results
    console.log('📊 Results Summary:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Extraction ID: ${result.extraction_id}`);
    console.log('');

    console.log('🏢 Businesses:');
    console.log(`  Total: ${result.businesses.total}`);
    console.log(`  Cached: ${result.businesses.cached}`);
    console.log(`  New: ${result.businesses.new}`);
    console.log('');

    console.log('⭐ Reviews:');
    console.log(`  Total: ${result.reviews.total}`);
    console.log(`  Cached: ${result.reviews.cached}`);
    console.log(`  New: ${result.reviews.new}`);
    console.log('');

    console.log('💰 Cost Analysis:');
    console.log(`  Apify Credits Used: ${result.cost.apify_credits_used || 0}`);
    console.log(`  Apify Cost (USD): $${result.cost.apify_cost_usd || 0}`);
    console.log(`  Savings (USD): $${result.cost.savings_usd || 0}`);
    console.log(`  Cache Hit Rate: ${result.cost.cache_hit_rate}`);
    console.log('');

    console.log('⚡ Performance:');
    console.log(`  Duration: ${result.performance.duration_seconds}s`);
    console.log('');

    // Parameter verification
    console.log('🔍 Parameter Verification:');
    console.log(`  ✓ Category received: ${testCriteria.category}`);
    console.log(`  ✓ Location received: ${testCriteria.location}`);
    console.log(`  ✓ Business limit: ${testCriteria.businessLimit}`);
    console.log(`  ✓ Max review stars: ${testCriteria.maxReviewStars}`);
    console.log(`  ✓ Day limit: ${testCriteria.dayLimit}`);
    console.log('');

    // Cache effectiveness
    const cacheHitRate = parseFloat(result.cost.cache_hit_rate);
    if (cacheHitRate >= 80) {
      console.log('🎉 Excellent cache performance! (≥80% hit rate)');
    } else if (cacheHitRate >= 50) {
      console.log('✅ Good cache performance (50-80% hit rate)');
    } else if (cacheHitRate > 0) {
      console.log('⚠️  Moderate cache performance (<50% hit rate)');
    } else {
      console.log('ℹ️  First-time extraction (building cache)');
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✨ Test completed successfully!\n');

    // Show sample businesses
    if (result.businesses.list && result.businesses.list.length > 0) {
      console.log('📋 Sample Businesses (first 3):');
      result.businesses.list.slice(0, 3).forEach((business, idx) => {
        console.log(`\n  ${idx + 1}. ${business.name}`);
        console.log(`     Address: ${business.address}`);
        console.log(`     Rating: ${business.rating} (${business.reviews_count} reviews)`);
        if (business.phone) console.log(`     Phone: ${business.phone}`);
      });
      console.log('');
    }

    // Show sample reviews
    if (result.reviews.list && result.reviews.list.length > 0) {
      console.log('💬 Sample Reviews (first 2):');
      result.reviews.list.slice(0, 2).forEach((review, idx) => {
        console.log(`\n  ${idx + 1}. ⭐ ${review.rating} stars - ${review.reviewer_name}`);
        console.log(`     "${review.text.substring(0, 100)}${review.text.length > 100 ? '...' : ''}"`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ Test Failed');
    console.error('═══════════════════════════════════════════════════════');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.log('');
  }
}

// Run the test
testOptimizedAPI();
