#!/usr/bin/env node
/**
 * Check Apify Account Status
 * Verifies token validity and account balance
 */

const https = require('https');

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

console.log('\n🔍 Apify Account Check');
console.log('═══════════════════════════════════════════════════════\n');

// Check 1: User Account Info
function checkAccount() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.apify.com',
      port: 443,
      path: `/v2/actor-tasks?token=${APIFY_TOKEN}&limit=1`,
      method: 'GET'
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          const user = JSON.parse(data).data;
          console.log('✅ Account Status: VALID');
          console.log(`   Email: ${user.email || 'N/A'}`);
          console.log(`   Plan: ${user.plan?.name || 'Free'}`);
          console.log(`   Monthly Usage Limit: $${user.plan?.monthlyUsageLimitUsd || 0}`);
          resolve(user);
        } else if (res.statusCode === 401) {
          console.log('❌ Token Status: INVALID (401 Unauthorized)');
          console.log('   The API token is not valid or has expired');
          resolve(null);
        } else if (res.statusCode === 403) {
          console.log('❌ Token Status: FORBIDDEN (403)');
          console.log('   The token does not have required permissions');
          resolve(null);
        } else {
          console.log(`❌ API Error: ${res.statusCode}`);
          console.log(`   Response: ${data}`);
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

// Check 2: Account Usage
function checkUsage() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.apify.com',
      port: 443,
      path: `/v2/user-monthly-usage?token=${APIFY_TOKEN}`,
      method: 'GET'
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          const usage = JSON.parse(data).data;
          console.log('\n💰 Account Balance:');
          console.log(`   Platform Credits: $${(usage.platformUsage?.usd || 0).toFixed(2)}`);
          console.log(`   Total Usage This Month: $${(usage.totalUsageUsd || 0).toFixed(2)}`);

          if (usage.platformUsage?.usd === 0 && usage.totalUsageUsd > 0) {
            console.log('   ⚠️  WARNING: No credits remaining!');
          }
          resolve(usage);
        } else {
          console.log(`\n❌ Usage API Error: ${res.statusCode}`);
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

// Check 3: Test Actor Access
function testActorAccess() {
  return new Promise((resolve, reject) => {
    const actorId = 'compass~crawler-google-places';
    const options = {
      hostname: 'api.apify.com',
      port: 443,
      path: `/v2/acts/${actorId}?token=${APIFY_TOKEN}`,
      method: 'GET'
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          const actor = JSON.parse(data).data;
          console.log(`\n✅ Actor Access: ${actor.name || actorId}`);
          console.log(`   Can run: YES`);
          resolve(true);
        } else if (res.statusCode === 403) {
          console.log(`\n❌ Actor Access: FORBIDDEN (403)`);
          console.log(`   The account cannot access actor: ${actorId}`);
          console.log(`   Possible reasons:`);
          console.log(`   - Actor requires paid plan`);
          console.log(`   - Token doesn't have actor permissions`);
          console.log(`   - Account has no credits`);
          resolve(false);
        } else {
          console.log(`\n❌ Actor Check Error: ${res.statusCode}`);
          console.log(`   Response: ${data}`);
          resolve(false);
        }
      });
    }).on('error', reject);
  });
}

// Run all checks
async function main() {
  try {
    console.log(`Token (first 20 chars): ${APIFY_TOKEN.substring(0, 20)}...`);
    console.log('');

    const account = await checkAccount();
    if (!account) {
      console.log('\n❌ Cannot proceed - invalid token');
      return;
    }

    await checkUsage();
    await testActorAccess();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✨ Check complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

main();
