/**
 * Batch Import Apify Datasets to QuartzIQ Database
 *
 * This script:
 * 1. Downloads multiple Apify datasets
 * 2. Caches businesses in QuartzIQ database
 * 3. Extracts place IDs for review crawling
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Your datasets to import
const DATASETS = [
  'p40lDukqamidseCk5',
  'xEBoJKLAyTCwGBICm',
  'mZb6HVflOjcTgOCwJ',
  'a54Rui9ZFYv0GfcVM'
];

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

// PostgreSQL connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

console.log('============================================================');
console.log('           BATCH IMPORT APIFY DATASETS');
console.log('============================================================\n');

if (!APIFY_TOKEN) {
  console.log('❌ APIFY_API_TOKEN not found in .env.local');
  process.exit(1);
}

if (!process.env.POSTGRES_HOST) {
  console.log('❌ PostgreSQL configuration not found');
  process.exit(1);
}

// Create import directory
const importDir = path.join(__dirname, '..', 'data', 'apify-imports');
fs.mkdirSync(importDir, { recursive: true });

async function downloadDataset(datasetId) {
  console.log(`\n📥 Downloading dataset: ${datasetId}`);
  console.log('─'.repeat(60));

  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`❌ Failed to download: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log(`✅ Downloaded ${data.length} businesses`);

    // Save to file
    const filePath = path.join(importDir, `dataset-${datasetId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`💾 Saved to: ${path.basename(filePath)}`);

    return { datasetId, data, filePath };
  } catch (error) {
    console.log(`❌ Error downloading dataset: ${error.message}`);
    return null;
  }
}

async function cacheBusinesses(dataset) {
  console.log(`\n💾 Caching businesses from ${dataset.datasetId} to database...`);
  console.log('─'.repeat(60));

  const businesses = dataset.data;
  let cached = 0;
  let skipped = 0;

  for (const business of businesses) {
    const placeId = business.placeId || business.place_id;

    if (!placeId) {
      skipped++;
      continue;
    }

    try {
      // Check if business already exists
      const checkQuery = 'SELECT id FROM businesses WHERE place_id = $1';
      const checkResult = await pool.query(checkQuery, [placeId]);

      if (checkResult.rows.length > 0) {
        skipped++;
        continue;
      }

      // Insert new business
      const insertQuery = `
        INSERT INTO businesses (
          place_id, name, address, city, category,
          rating, reviews_count, phone, website,
          google_maps_url, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (place_id) DO NOTHING
      `;

      await pool.query(insertQuery, [
        placeId,
        business.title || business.name,
        business.address,
        business.city,
        business.categoryName || business.category,
        business.totalScore || business.rating,
        business.reviewsCount || business.reviews_count,
        business.phone,
        business.website,
        business.url,
        JSON.stringify(business)
      ]);

      cached++;
      if (cached % 10 === 0) {
        process.stdout.write(`   Cached ${cached}/${businesses.length}...\r`);
      }
    } catch (error) {
      // If it's a duplicate key error, that's fine
      if (error.code === '23505') {
        skipped++;
      } else {
        console.log(`\n⚠️  Error caching ${placeId}: ${error.message}`);
      }
    }
  }

  console.log(`\n✅ Cached ${cached} businesses`);
  console.log(`ℹ️  Skipped ${skipped} (duplicates or invalid)`);

  return { cached, skipped, total: businesses.length };
}

async function extractPlaceIds(datasets) {
  console.log('\n\n📍 Extracting Place IDs from All Datasets');
  console.log('='.repeat(60));

  const allPlaceIds = [];

  for (const dataset of datasets) {
    if (!dataset) continue;

    const placeIds = dataset.data
      .filter(item => item.placeId || item.place_id)
      .map(item => item.placeId || item.place_id);

    allPlaceIds.push(...placeIds);
    console.log(`✅ ${dataset.datasetId}: ${placeIds.length} place IDs`);
  }

  // Remove duplicates
  const uniquePlaceIds = [...new Set(allPlaceIds)];

  console.log('\n' + '─'.repeat(60));
  console.log(`📊 Total: ${uniquePlaceIds.length} unique place IDs`);
  console.log('─'.repeat(60));

  // Save to file
  const outputPath = path.join(__dirname, '..', 'data', 'place-ids-for-review-crawl.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    placeIds: uniquePlaceIds,
    count: uniquePlaceIds.length,
    source: 'batch_import',
    timestamp: new Date().toISOString()
  }, null, 2));

  console.log(`\n💾 Saved to: place-ids-for-review-crawl.json`);

  // Also save as comma-separated for easy copy/paste
  const csvPath = path.join(__dirname, '..', 'data', 'place-ids-comma-separated.txt');
  fs.writeFileSync(csvPath, uniquePlaceIds.join(','));
  console.log(`💾 Comma-separated: place-ids-comma-separated.txt`);

  return uniquePlaceIds;
}

async function main() {
  console.log(`📋 Importing ${DATASETS.length} datasets:\n`);
  DATASETS.forEach((id, idx) => {
    console.log(`   ${idx + 1}. ${id}`);
  });
  console.log('');

  // Step 1: Download all datasets
  console.log('\n🔄 STEP 1: Downloading Datasets');
  console.log('='.repeat(60));

  const downloadedDatasets = [];
  for (const datasetId of DATASETS) {
    const dataset = await downloadDataset(datasetId);
    if (dataset) {
      downloadedDatasets.push(dataset);
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (downloadedDatasets.length === 0) {
    console.log('\n❌ No datasets downloaded successfully');
    process.exit(1);
  }

  // Step 2: Cache businesses in database
  console.log('\n\n🔄 STEP 2: Caching Businesses to Database');
  console.log('='.repeat(60));

  let totalCached = 0;
  let totalSkipped = 0;
  let totalBusinesses = 0;

  for (const dataset of downloadedDatasets) {
    const result = await cacheBusinesses(dataset);
    totalCached += result.cached;
    totalSkipped += result.skipped;
    totalBusinesses += result.total;
  }

  // Step 3: Extract place IDs
  console.log('\n\n🔄 STEP 3: Extracting Place IDs');
  console.log('='.repeat(60));

  const placeIds = await extractPlaceIds(downloadedDatasets);

  // Final Summary
  console.log('\n\n✅ IMPORT COMPLETE!');
  console.log('='.repeat(60));
  console.log(`📦 Datasets processed: ${downloadedDatasets.length}/${DATASETS.length}`);
  console.log(`💾 Businesses cached: ${totalCached}`);
  console.log(`⏭️  Businesses skipped: ${totalSkipped} (duplicates)`);
  console.log(`📍 Place IDs ready: ${placeIds.length}`);
  console.log('='.repeat(60));

  console.log('\n\n🎯 NEXT STEPS:');
  console.log('─'.repeat(60));
  console.log('1. ✅ Businesses are now cached in your database');
  console.log('2. 📍 Place IDs are ready in: data/place-ids-for-review-crawl.json');
  console.log('3. 🚀 Run review qualification crawl with these place IDs');
  console.log('\nTo run review crawl, use the comma-separated list from:');
  console.log('   data/place-ids-comma-separated.txt');
  console.log('─'.repeat(60));
  console.log('\n');

  // Close database connection
  await pool.end();
}

main().catch(async error => {
  console.error('\n❌ Fatal Error:', error);
  await pool.end();
  process.exit(1);
});
