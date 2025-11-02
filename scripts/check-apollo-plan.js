/**
 * Check Apollo Plan Status
 * Verifies your current Apollo plan and API access
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const axios = require('axios');

async function checkApolloPlan() {
  console.log('🔍 Checking Apollo Plan Status');
  console.log('='.repeat(60));
  console.log('');

  const apiKey = process.env.APOLLO_API_KEY;

  if (!apiKey) {
    console.error('❌ APOLLO_API_KEY not found in .env.local');
    process.exit(1);
  }

  console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');
  console.log('');

  // Try to get account info
  console.log('📡 Checking account status...');
  console.log('');

  try {
    // Try the account info endpoint
    const response = await axios.get(
      'https://api.apollo.io/api/v1/auth/health',
      {
        headers: {
          'X-Api-Key': apiKey,
        },
        timeout: 10000,
      }
    );

    console.log('✅ API Key is valid!');
    console.log('');
    console.log('📊 Account Status:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    if (error.response) {
      console.error('❌ API Response:', error.response.status);
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Error:', error.message);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('');
  console.log('🔧 Troubleshooting Steps:');
  console.log('');
  console.log('1. Verify your plan upgrade:');
  console.log('   → Visit: https://app.apollo.io/settings/plans');
  console.log('   → Check that "API Access" is listed as included');
  console.log('');
  console.log('2. Wait for propagation (if just upgraded):');
  console.log('   → Plan upgrades can take 5-15 minutes to activate');
  console.log('   → Try again in a few minutes');
  console.log('');
  console.log('3. Regenerate API key (recommended):');
  console.log('   → Visit: https://app.apollo.io/settings/integrations');
  console.log('   → Click "Regenerate API Key"');
  console.log('   → Copy the new key');
  console.log('   → Update .env.local with: APOLLO_API_KEY=your_new_key');
  console.log('   → Test again: node scripts/test-apollo-api.js');
  console.log('');
  console.log('4. Verify API access in plan:');
  console.log('   → Some plans have "exports" but not "API access"');
  console.log('   → Ensure your plan specifically includes API access');
  console.log('   → Contact Apollo support if unclear');
  console.log('');
  console.log('5. Check plan limits:');
  console.log('   → Basic: 500 exports/month + API access');
  console.log('   → Professional: 1000 exports/month + API access');
  console.log('   → If you see "API Access: ✓" on your plan page, you\'re good');
  console.log('');
}

checkApolloPlan().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
