/**
 * Import Apify Crawls to QuartzIQ
 * Fetches business IDs from existing Apify dataset runs
 *
 * This allows you to:
 * 1. Get business/place IDs from Apify runs
 * 2. Cache them in QuartzIQ database
 * 3. Run review qualification on them
 */

const fs = require('fs');
const path = require('path');

console.log('📥 Apify Crawl Import Tool\n');
console.log('This tool helps you import business IDs from existing Apify runs\n');

// Available Apify dataset IDs from your account
const APIFY_DATASETS = {
  'insurance_amsterdam': 'YOUR_DATASET_ID_HERE',
  'dentist_amsterdam': 'YOUR_DATASET_ID_HERE',
  // Add more as needed
};

console.log('📋 How to Use This Tool:\n');
console.log('OPTION 1: Import from Apify Dataset');
console.log('─'.repeat(60));
console.log('1. Go to https://console.apify.com');
console.log('2. Open your actor run (Google Maps Scraper)');
console.log('3. Click "Dataset" tab');
console.log('4. Copy the dataset ID from the URL');
console.log('   Example: https://console.apify.com/storage/datasets/[DATASET_ID]');
console.log('5. Run: node scripts/import-apify-crawls.js [DATASET_ID]\n');

console.log('OPTION 2: Import from Downloaded JSON');
console.log('─'.repeat(60));
console.log('1. Go to https://console.apify.com');
console.log('2. Open your actor run');
console.log('3. Click "Dataset" → "Export" → "JSON"');
console.log('4. Save to: data/apify-imports/crawl-[name].json');
console.log('5. Run: node scripts/import-apify-crawls.js --file crawl-[name].json\n');

console.log('OPTION 3: List All Business IDs');
console.log('─'.repeat(60));
console.log('If you just want the place IDs for manual use:');
console.log('1. Download JSON from Apify');
console.log('2. Run: node scripts/import-apify-crawls.js --extract-ids crawl.json');
console.log('3. Gets you a list of place IDs to use in review crawl\n');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('❌ No arguments provided\n');
  console.log('Examples:');
  console.log('  node scripts/import-apify-crawls.js abc123dataset');
  console.log('  node scripts/import-apify-crawls.js --file data/apify-imports/crawl.json');
  console.log('  node scripts/import-apify-crawls.js --extract-ids data/crawl.json\n');
  process.exit(1);
}

async function extractPlaceIds(filePath) {
  console.log(`📂 Reading file: ${filePath}\n`);

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!Array.isArray(data)) {
      console.log('❌ File is not a valid Apify dataset (should be an array)');
      process.exit(1);
    }

    console.log(`✅ Found ${data.length} businesses in file\n`);

    // Extract place IDs
    const placeIds = data
      .filter(item => item.placeId || item.place_id)
      .map(item => item.placeId || item.place_id);

    console.log(`📍 Extracted ${placeIds.length} place IDs:\n`);
    console.log('─'.repeat(60));

    // Group by first 5
    console.log('First 10 place IDs:');
    placeIds.slice(0, 10).forEach((id, idx) => {
      console.log(`  ${idx + 1}. ${id}`);
    });

    if (placeIds.length > 10) {
      console.log(`  ... and ${placeIds.length - 10} more`);
    }

    console.log('\n' + '─'.repeat(60));

    // Save to file
    const outputPath = path.join(__dirname, '..', 'data', 'place-ids-extracted.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({ placeIds, count: placeIds.length }, null, 2));

    console.log(`\n✅ Place IDs saved to: ${outputPath}`);
    console.log(`\n📋 Copy/paste format (for review extraction):`);
    console.log('─'.repeat(60));
    console.log(placeIds.join(','));
    console.log('─'.repeat(60));

    console.log('\n🎯 Next Steps:');
    console.log('1. Use these place IDs in your review qualification crawl');
    console.log('2. Or import them to QuartzIQ database first');
    console.log('3. Then run review extraction on cached businesses\n');

  } catch (error) {
    console.error('❌ Error reading file:', error.message);
    process.exit(1);
  }
}

async function importFromDataset(datasetId) {
  console.log(`📥 Fetching from Apify dataset: ${datasetId}\n`);

  const APIFY_TOKEN = process.env.APIFY_TOKEN;

  if (!APIFY_TOKEN) {
    console.log('❌ APIFY_TOKEN not found in environment');
    console.log('   Set it with: export APIFY_TOKEN=your_token_here\n');
    process.exit(1);
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`;

    console.log('⏳ Downloading dataset...');
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`❌ Failed to fetch dataset: ${response.statusText}`);
      process.exit(1);
    }

    const data = await response.json();
    console.log(`✅ Downloaded ${data.length} businesses\n`);

    // Save to file
    const outputPath = path.join(__dirname, '..', 'data', 'apify-imports', `dataset-${datasetId}.json`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

    console.log(`💾 Saved to: ${outputPath}\n`);

    // Extract place IDs
    await extractPlaceIds(outputPath);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Handle arguments
if (args[0] === '--extract-ids' || args[0] === '--file') {
  const filePath = args[1];
  if (!filePath) {
    console.log('❌ Please provide file path');
    process.exit(1);
  }
  extractPlaceIds(filePath);
} else {
  // Assume it's a dataset ID
  importFromDataset(args[0]);
}
