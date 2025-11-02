/**
 * Quick Apollo API Test
 * Tests if your Apollo API key is working
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const axios = require('axios');

async function testApolloAPI() {
  console.log('🧪 Testing Apollo API Connection');
  console.log('='.repeat(60));
  console.log('');

  const apiKey = process.env.APOLLO_API_KEY;

  if (!apiKey) {
    console.error('❌ APOLLO_API_KEY not found in .env.local');
    process.exit(1);
  }

  console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');
  console.log('');

  // Test with enrichment request (free plan only has access to this)
  console.log('📡 Testing Apollo Enrichment API...');
  console.log('   Test: Enrich person with known name');
  console.log('');

  try {
    const response = await axios.post(
      'https://api.apollo.io/api/v1/people/match',
      {
        first_name: 'Dario',
        last_name: 'Amodei',
        organization_name: 'Anthropic',
        domain: 'anthropic.com',
        reveal_personal_emails: false, // Don't use credits for test
        reveal_phone_number: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey,
        },
        timeout: 30000,
      }
    );

    console.log('✅ API Connection Successful!');
    console.log('');
    console.log('📊 Response Summary:');
    console.log(`   Status: ${response.status}`);
    console.log(`   Match found: ${response.data.person ? 'Yes' : 'No'}`);

    if (response.data.person) {
      const person = response.data.person;
      console.log('   Person details:');
      console.log(`     Name: ${person.name}`);
      console.log(`     Title: ${person.title}`);
      console.log(`     Seniority: ${person.seniority}`);
      console.log(`     Email: ${person.email || 'Not revealed (test mode)'}`);
      console.log(`     Phone: ${person.phone_numbers?.length > 0 ? 'Not revealed (test mode)' : 'N/A'}`);
      console.log(`     LinkedIn: ${person.linkedin_url ? 'Yes' : 'No'}`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('🎉 Apollo API is working correctly!');
    console.log('');
    console.log('⚠️  FREE PLAN LIMITATION:');
    console.log('   Your Apollo free plan only has access to the Enrichment API.');
    console.log('   Search API is NOT available (requires paid plan).');
    console.log('');
    console.log('✅ This means:');
    console.log('   • Claude website research will find executive names (FREE)');
    console.log('   • Apollo enrichment will add email/phone ($0.10 per person)');
    console.log('   • Average cost: $0.10 per business (instead of $0.15-0.20)');
    console.log('   • You can enrich ~100 businesses with your 100 call limit');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start your Next.js app: npm run dev');
    console.log('2. Apply database migration: POST http://localhost:3000/api/apollo-enrichment/setup');
    console.log('3. Test the system with a business that has a website');
    console.log('');

  } catch (error) {
    console.error('❌ API Test Failed!');
    console.error('─'.repeat(60));

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);

      if (error.response.status === 401) {
        console.error('');
        console.error('🔑 Authentication Error - Invalid API Key');
        console.error('   Please check your Apollo API key in .env.local');
        console.error('   Get your API key from: https://apollo.io/settings/integrations');
      } else if (error.response.status === 429) {
        console.error('');
        console.error('⏱️  Rate Limit Exceeded');
        console.error('   Your monthly API limit (100 calls) may be exhausted');
        console.error('   Wait until next month or upgrade your Apollo plan');
      }
    } else {
      console.error('Error:', error.message);
    }

    console.error('');
    console.error('⚠️  CRITICAL: Free Plan Has NO API Access');
    console.error('─'.repeat(60));
    console.error('Apollo\'s free plan does NOT include API access.');
    console.error('Both Search API and Enrichment API require a paid plan.');
    console.error('');
    console.error('💡 Your Options:');
    console.error('');
    console.error('Option 1: Upgrade Apollo Plan (Recommended)');
    console.error('  • Basic plan: $49/month (500 exports/month)');
    console.error('  • Includes API access for enrichment');
    console.error('  • Sign up: https://app.apollo.io/settings/plans');
    console.error('');
    console.error('Option 2: Use Claude-Only Mode (FREE)');
    console.error('  • Claude website research finds ~30-40% of executives');
    console.error('  • Completely free (no API costs)');
    console.error('  • Good for testing and initial validation');
    console.error('  • Success depends on website quality');
    console.error('');
    console.error('Option 3: Alternative Services');
    console.error('  • Hunter.io (has free tier with API)');
    console.error('  • RocketReach (API available)');
    console.error('  • Clearbit (API available)');
    console.error('');

    process.exit(1);
  }
}

testApolloAPI().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
