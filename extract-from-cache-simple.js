#!/usr/bin/env node
/**
 * SIMPLE TARGETED REVIEW EXTRACTION FROM CACHE
 *
 * Uses the optimized API endpoint to extract reviews from cached businesses
 * Much simpler - just calls the API that's already working!
 *
 * Cost Optimization:
 * - Businesses from cache: FREE
 * - Review extraction: ~$0.02 per business
 * - vs Full extraction: ~$0.05-0.10 per business
 */

const http = require('http');  // Use http for localhost
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

// Configuration
const CONFIG = {
  category: process.argv[2] || 'tandarts',
  location: process.argv[3] || 'Amsterdam',
  businessLimit: parseInt(process.argv[4]) || 5,
  maxReviewStars: 3,
  dayLimit: 30,
  maxReviewsPerBusiness: 10,
};

console.log('\n🚀 TARGETED REVIEW EXTRACTION FROM CACHE\n');
console.log('═══════════════════════════════════════════════════════\n');
console.log('⚙️  Configuration:');
console.log(JSON.stringify(CONFIG, null, 2));
console.log('\n💡 Usage: node extract-from-cache-simple.js [category] [location] [businessLimit]');
console.log('   Example: node extract-from-cache-simple.js tandarts Amsterdam 10\n');

const startTime = Date.now();

// Make API call to optimized extraction endpoint
const postData = JSON.stringify(CONFIG);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/extract-optimized',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-API-Key': 'quartziq_1236e22634e48db6b08754f0a6dd5f40dac1a28cb8067fdbf2e0faaee86ffae5',
  },
  timeout: 300000  // 5 minute timeout
};

console.log('🔄 Calling optimized API endpoint...\n');
console.log(`   POST http://localhost:3000/api/extract-optimized`);
console.log(`   Timeout: 5 minutes\n`);

const req = http.request(options, (res) => {
  let data = '';

  console.log(`📡 Response Status: ${res.statusCode}\n`);

  res.on('data', (chunk) => {
    data += chunk;
    process.stdout.write('.');
  });

  res.on('end', () => {
    console.log('\n\n✅ Request completed\n');

    try {
      const result = JSON.parse(data);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('═══════════════════════════════════════════════════════');
      console.log('📊 EXTRACTION RESULTS');
      console.log('═══════════════════════════════════════════════════════\n');

      if (result.success) {
        console.log('✅ SUCCESS!\n');

        const businesses = result.businesses?.list || [];
        const reviews = result.reviews?.list || [];

        console.log('📋 Summary:');
        console.log(`   Businesses found: ${businesses.length}`);
        console.log(`   Reviews extracted: ${reviews.length}`);
        console.log(`   Negative reviews (≤${CONFIG.maxReviewStars}★): ${reviews.filter(r => r.rating <= CONFIG.maxReviewStars).length}`);
        console.log(`   Duration: ${duration}s`);

        if (result.businesses) {
          console.log('\n💾 Cache Performance:');
          console.log(`   Businesses cached: ${result.businesses.cached || 0}`);
          console.log(`   Businesses new: ${result.businesses.new || 0}`);
          const cacheRate = result.businesses.total > 0 ? ((result.businesses.cached / result.businesses.total) * 100).toFixed(1) : '0.0';
          console.log(`   Cache hit rate: ${cacheRate}%`);
        }

        if (result.cost) {
          console.log('\n💰 Cost Breakdown:');
          console.log(`   Business search: $${result.cost.business_search_usd || '0.00'} (cached! 🎉)`);
          console.log(`   Review extraction: $${result.cost.review_extraction_usd || '0.00'}`);
          console.log(`   Total cost: $${result.cost.total_usd || '0.00'}`);
          console.log(`   💵 Savings: $${result.cost.savings_usd || '0.00'} (${result.cost.savings_percent || '0'}%)`);
        }

        if (businesses.length > 0) {
          console.log('\n📋 Businesses Processed:');
          businesses.slice(0, 10).forEach((b, idx) => {
            console.log(`\n   ${idx + 1}. ${b.name}`);
            console.log(`      Rating: ⭐ ${b.rating}★ (${b.reviews_count} total reviews)`);
            console.log(`      Address: ${b.address}`);
            const businessReviews = reviews.filter(r => r.business_id === b.id);
            const negReviews = businessReviews.filter(r => r.rating <= CONFIG.maxReviewStars);
            console.log(`      Reviews extracted: ${businessReviews.length} (${negReviews.length} negative)`);
          });

          if (businesses.length > 10) {
            console.log(`\n   ... and ${businesses.length - 10} more businesses`);
          }
        }

        console.log('\n═══════════════════════════════════════════════════════\n');
        console.log('✅ Extraction complete! Reviews are cached in the database.\n');

      } else {
        console.log('❌ EXTRACTION FAILED\n');
        console.log(`   Error: ${result.error || 'Unknown error'}`);
        if (result.details) {
          console.log(`   Details: ${result.details}`);
        }
      }

    } catch (error) {
      console.error('\n❌ Failed to parse response:', error.message);
      console.log('\nRaw response:');
      console.log(data.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Request failed:', error.message);
  console.log('\n⚠️  Make sure the development server is running:');
  console.log('   cd /Users/kris/CLAUDEtools/QuartzIQ');
  console.log('   npm run dev');
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  console.error('\n❌ Request timed out after 5 minutes');
  console.log('\n💡 TIP: Try reducing businessLimit or maxReviewsPerBusiness');
  process.exit(1);
});

// Send the request
req.write(postData);
req.end();

console.log('⏳ Waiting for extraction to complete...');
console.log('   (This may take 1-3 minutes depending on businessLimit)\n');
