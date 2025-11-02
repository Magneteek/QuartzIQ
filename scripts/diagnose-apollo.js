/**
 * Apollo API Comprehensive Diagnostics
 * Tests multiple endpoints to understand your access level
 */

require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function diagnose() {
  console.log('🔬 Apollo API Comprehensive Diagnostics');
  console.log('='.repeat(60));
  console.log('');

  const apiKey = process.env.APOLLO_API_KEY;
  console.log('API Key:', apiKey.substring(0, 15) + '...');
  console.log('');

  const endpoints = [
    {
      name: 'Health Check',
      method: 'GET',
      url: 'https://api.apollo.io/api/v1/auth/health',
      data: null,
    },
    {
      name: 'Account Info',
      method: 'GET',
      url: 'https://api.apollo.io/api/v1/users/self',
      data: null,
    },
    {
      name: 'Email Status',
      method: 'GET',
      url: 'https://api.apollo.io/api/v1/email_accounts',
      data: null,
    },
    {
      name: 'Organization Search (Basic)',
      method: 'POST',
      url: 'https://api.apollo.io/api/v1/organizations/search',
      data: { q_organization_name: 'Test', per_page: 1 },
    },
    {
      name: 'People Search',
      method: 'POST',
      url: 'https://api.apollo.io/api/v1/mixed_people/search',
      data: { q_organization_domains_list: ['anthropic.com'], per_page: 1 },
    },
    {
      name: 'People Match (Enrichment)',
      method: 'POST',
      url: 'https://api.apollo.io/api/v1/people/match',
      data: {
        first_name: 'Dario',
        last_name: 'Amodei',
        domain: 'anthropic.com',
        reveal_personal_emails: false,
        reveal_phone_number: false,
      },
    },
  ];

  console.log('Testing', endpoints.length, 'API endpoints...');
  console.log('');

  const results = [];

  for (const endpoint of endpoints) {
    console.log('─'.repeat(60));
    console.log(`📡 Testing: ${endpoint.name}`);
    console.log(`   ${endpoint.method} ${endpoint.url}`);

    try {
      const config = {
        method: endpoint.method,
        url: endpoint.url,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        timeout: 10000,
      };

      if (endpoint.data) {
        config.data = endpoint.data;
      }

      const response = await axios(config);

      console.log(`   ✅ Status: ${response.status}`);

      // Show key response fields
      if (response.data) {
        if (response.data.user) {
          console.log(`   👤 User:`, response.data.user.email || 'N/A');
          console.log(`   📦 Team:`, response.data.user.team_name || 'N/A');
        }
        if (response.data.pagination) {
          console.log(`   📊 Results:`, response.data.pagination.total_entries || 0);
        }
        if (response.data.person) {
          console.log(`   👤 Match:`, response.data.person.name);
        }
      }

      results.push({ endpoint: endpoint.name, status: 'SUCCESS', code: response.status });

    } catch (error) {
      if (error.response) {
        console.log(`   ❌ Status: ${error.response.status}`);
        console.log(`   Error:`, error.response.data?.error || error.response.data?.message || 'Unknown');
        console.log(`   Code:`, error.response.data?.error_code || 'N/A');

        results.push({
          endpoint: endpoint.name,
          status: 'FAILED',
          code: error.response.status,
          error: error.response.data?.error || error.response.data?.message,
          error_code: error.response.data?.error_code,
        });
      } else {
        console.log(`   ❌ Network Error:`, error.message);
        results.push({ endpoint: endpoint.name, status: 'NETWORK_ERROR', error: error.message });
      }
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  console.log('');

  const successful = results.filter(r => r.status === 'SUCCESS').length;
  const failed = results.filter(r => r.status === 'FAILED').length;

  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log('');

  console.log('Detailed Results:');
  results.forEach(r => {
    const icon = r.status === 'SUCCESS' ? '✅' : '❌';
    console.log(`  ${icon} ${r.endpoint}: ${r.status}`);
    if (r.error) {
      console.log(`     Error: ${r.error}`);
    }
  });

  console.log('');
  console.log('='.repeat(60));
  console.log('');

  // Recommendations
  if (failed > 0) {
    const hasApiAccessError = results.some(r =>
      r.error_code === 'API_INACCESSIBLE' ||
      (r.error && r.error.includes('not accessible'))
    );

    if (hasApiAccessError) {
      console.log('⚠️  API ACCESS ISSUE DETECTED');
      console.log('');
      console.log('Your API key is valid, but API endpoints are blocked.');
      console.log('');
      console.log('Possible causes:');
      console.log('1. Plan upgrade is still propagating (wait 15-30 minutes)');
      console.log('2. Your plan does not include API access');
      console.log('3. API access needs to be manually enabled in settings');
      console.log('');
      console.log('Next steps:');
      console.log('1. Check your plan features at:');
      console.log('   https://app.apollo.io/settings/plans');
      console.log('');
      console.log('2. Look for these features:');
      console.log('   ✓ API Access');
      console.log('   ✓ Email Credits');
      console.log('   ✓ Phone Credits');
      console.log('');
      console.log('3. If you just upgraded, wait 15-30 minutes and try again');
      console.log('');
      console.log('4. If API Access is NOT listed, you may need:');
      console.log('   - A different plan tier with API included');
      console.log('   - To contact Apollo support to enable API');
      console.log('');
      console.log('5. Check if there\'s an API toggle/setting at:');
      console.log('   https://app.apollo.io/settings/integrations');
      console.log('');
    }
  } else {
    console.log('🎉 All endpoints are accessible!');
    console.log('Your Apollo API is fully functional.');
    console.log('');
    console.log('Next step: Run the full system test');
    console.log('npm run test:apollo-enrichment -- --useRealApi=true');
  }
}

diagnose().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
