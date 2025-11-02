#!/usr/bin/env node
/**
 * Test Optimized API with ENGLISH category
 * Tests category translation: "dentist" → "tandarts"
 */

const API_KEY = 'quartziq_1236e22634e48db6b08754f0a6dd5f40dac1a28cb8067fdbf2e0faaee86ffae5';
const API_URL = 'http://localhost:3000/api/extract-optimized';

// Test with ENGLISH category
const testCriteria = {
  category: 'dentist',  // English!
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

console.log('\n🔧 QuartzIQ Category Translation Test');
console.log('═══════════════════════════════════════════════════════\n');

console.log('📋 Test Configuration (ENGLISH CATEGORY):');
console.log(JSON.stringify(testCriteria, null, 2));

console.log('\n🚀 Testing translation: "dentist" → "tandarts"...\n');

async function testEnglishCategory() {
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
    console.log('📊 Translation Test Results:');
    console.log(`  Input Category: "${testCriteria.category}" (English)`);
    console.log(`  Businesses Found: ${result.businesses.total}`);
    console.log(`  Cache Hit Rate: ${result.cost.cache_hit_rate}`);
    console.log('');

    if (result.businesses.total > 0) {
      console.log('🎉 SUCCESS! Category translation worked!');
      console.log('   "dentist" (EN) was translated to "tandarts" (NL)');
      console.log('   Cache search found Dutch businesses ✅\n');

      console.log('📋 Sample Business (proof it worked):');
      const business = result.businesses.list[0];
      console.log(`   ${business.name}`);
      console.log(`   Category in database: ${business.category || 'N/A'}`);
      console.log(`   Rating: ${business.rating} (${business.reviews_count} reviews)`);
    } else {
      console.log('❌ FAILED: No businesses found');
      console.log('   Translation may not have worked\n');
    }

    console.log('\n💰 Cost Analysis:');
    console.log(`  Apify Cost (USD): $${result.cost.apify_cost_usd || 0}`);
    console.log(`  Savings (USD): $${result.cost.savings_usd || 0}`);
    console.log(`  Cache Hit Rate: ${result.cost.cache_hit_rate}`);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✨ Translation test complete!\n');

  } catch (error) {
    console.error('\n❌ Test Failed');
    console.error('═══════════════════════════════════════════════════════');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.log('');
  }
}

// Run the test
testEnglishCategory();
