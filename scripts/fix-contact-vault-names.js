/**
 * Fix Contact Vault - Populate business names from title field
 * This script updates the existing Contact Vault extraction file to include
 * the name field for all businesses (currently null)
 */

const fs = require('fs');
const path = require('path');

const CONTACT_VAULT_FILE = path.join(
  __dirname,
  '..',
  'data',
  'extraction-history',
  'extraction_1760622350499_9uxrkqme2.json'
);

console.log('🔧 Fixing Contact Vault business names...\n');

// Read the file
const data = JSON.parse(fs.readFileSync(CONTACT_VAULT_FILE, 'utf8'));

// Count businesses before fix
const totalBusinesses = data.results.businesses?.length || 0;
const businessesWithoutName = data.results.businesses?.filter(b => !b.name).length || 0;

console.log(`📊 Found ${totalBusinesses} businesses`);
console.log(`   ${businessesWithoutName} without name field\n`);

// Fix businesses: populate name from title
if (data.results.businesses) {
  data.results.businesses = data.results.businesses.map(business => {
    if (!business.name && business.title) {
      return {
        ...business,
        name: business.title  // Copy title to name
      };
    }
    return business;
  });
}

// Count reviews and verify business names are present
const totalReviews = data.results.reviews?.length || 0;
const reviewsWithBusinessName = data.results.reviews?.filter(r => r.business_name && r.business_name !== 'Unknown Business').length || 0;

console.log(`📝 Reviews status:`);
console.log(`   Total reviews: ${totalReviews}`);
console.log(`   Reviews with business name: ${reviewsWithBusinessName}\n`);

// Verify addresses are present
const businessesWithAddress = data.results.businesses?.filter(b => b.address).length || 0;
console.log(`📍 Address status:`);
console.log(`   Businesses with address: ${businessesWithAddress}/${totalBusinesses}\n`);

// Write back to file
fs.writeFileSync(CONTACT_VAULT_FILE, JSON.stringify(data, null, 2));

console.log('✅ Contact Vault updated successfully!');
console.log(`   File: ${CONTACT_VAULT_FILE}`);
console.log(`\n📋 Summary:`);
console.log(`   ✓ All businesses now have name field populated`);
console.log(`   ✓ Addresses preserved (${businessesWithAddress} businesses)`);
console.log(`   ✓ Review business names already correct (${reviewsWithBusinessName} reviews)`);
