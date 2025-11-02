/**
 * Test Extraction - Verify Database Fix
 * Runs a small 10-business test to confirm caching works
 */

const fetch = require('node-fetch');

async function testExtraction() {
  console.log('🧪 Running Test Extraction (10 businesses)\n');
  console.log('This will verify the database trigger fix is working...\n');

  const API_KEY = 'quartziq_1236e22634e48db6b08754f0a6dd5f40dac1a28cb8067fdbf2e0faaee86ffae5';
  const API_URL = 'http://localhost:3000/api/extract-optimized';

  const testCriteria = {
    category: 'insurance_agency',
    location: 'Amsterdam',
    businessLimit: 10,
    maxReviewStars: 3,
    dayLimit: 14,
    countryCode: 'nl',
    language: 'nl'
  };

  console.log('📋 Test Criteria:');
  console.log('─'.repeat(60));
  console.log(`   Category: ${testCriteria.category}`);
  console.log(`   Location: ${testCriteria.location}`);
  console.log(`   Business Limit: ${testCriteria.businessLimit} (small test)`);
  console.log(`   Max Review Stars: ${testCriteria.maxReviewStars}`);
  console.log(`   Day Limit: ${testCriteria.dayLimit}`);
  console.log('─'.repeat(60));
  console.log('');

  try {
    console.log('⏳ Sending request to extraction API...');
    console.log('   (This may take 30-60 seconds)\n');

    const startTime = Date.now();

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(testCriteria)
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ API Error:', error);
      process.exit(1);
    }

    const result = await response.json();

    console.log('✅ Extraction Complete!\n');
    console.log('📊 Results:');
    console.log('─'.repeat(60));
    console.log(`   Duration: ${duration}s`);
    console.log(`   Extraction ID: ${result.extraction_id || 'N/A'}`);
    console.log('');

    // Check businesses
    const businessesTotal = result.businesses?.total || 0;
    const businessesCached = result.businesses?.cached || 0;
    const businessesNew = result.businesses?.new || 0;

    console.log('📍 Businesses:');
    console.log(`   Total: ${businessesTotal}`);
    console.log(`   Cached: ${businessesCached}`);
    console.log(`   New: ${businessesNew}`);

    if (businessesNew > 0) {
      console.log('   ✅ New businesses were cached!');
      console.log(`   Sample: ${result.businesses?.list?.[0]?.title || 'N/A'}`);
    }

    console.log('');

    // Check reviews
    const reviewsTotal = result.reviews?.total || 0;
    const reviewsCached = result.reviews?.cached || 0;
    const reviewsNew = result.reviews?.new || 0;

    console.log('📝 Reviews:');
    console.log(`   Total: ${reviewsTotal}`);
    console.log(`   Cached: ${reviewsCached}`);
    console.log(`   New: ${reviewsNew}`);

    console.log('');
    console.log('─'.repeat(60));

    // Determine success
    if (businessesTotal === 0) {
      console.log('\n❌ DATABASE FIX FAILED!');
      console.log('\n   The extraction returned 0 businesses.');
      console.log('   This means the trigger error is still occurring.\n');
      console.log('🔧 Next Steps:');
      console.log('   1. Re-apply the SQL fix in Supabase');
      console.log('   2. Check the trigger with: SELECT tgname FROM pg_trigger WHERE tgrelid = \'businesses\'::regclass');
      console.log('   3. Restart the server and try again\n');
      process.exit(1);
    }

    console.log('\n✅ DATABASE FIX SUCCESSFUL!');
    console.log('\n   Businesses were cached properly!');
    console.log(`   The system found ${businessesTotal} businesses.`);

    if (reviewsTotal > 0) {
      console.log(`   Found ${reviewsTotal} qualifying reviews!`);
    } else {
      console.log('   (No qualifying reviews in this test - that\'s OK)');
    }

    console.log('\n🎯 Next Steps:');
    console.log('   1. ✅ Database is working correctly');
    console.log('   2. Now you can import your existing Apify crawls');
    console.log('   3. Use: node scripts/import-apify-crawls.js --extract-ids <file>');
    console.log('   4. Get those business IDs for review qualification!\n');

    // Show cost info
    if (result.cost) {
      console.log('💰 Cost Info:');
      console.log(`   Apify credits: ${result.cost.apify_credits_used || 0}`);
      console.log(`   Cost: $${result.cost.apify_cost_usd || 0}`);
      console.log(`   Savings: $${result.cost.savings_usd || 0}\n`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the test
console.log('\n' + '='.repeat(60));
console.log('           TEST EXTRACTION - DATABASE FIX VERIFICATION');
console.log('='.repeat(60) + '\n');

testExtraction();
