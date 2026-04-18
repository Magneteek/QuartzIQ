/**
 * Import Apify run results directly into the businesses table
 * Usage: node scripts/import-run-to-db.js <runId>
 */

const { Pool } = require('pg');

const RUN_ID = process.argv[2];
const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

if (!RUN_ID) {
  console.error('Usage: node scripts/import-run-to-db.js <runId>');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fetchRunItems(runId) {
  const url = `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=1000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Apify API error: ${res.statusText}`);
  return res.json();
}

async function upsertBusiness(client, item) {
  const placeId = item.placeId;
  if (!placeId) return null;

  // Check for duplicate
  const existing = await client.query(
    'SELECT id FROM businesses WHERE place_id = $1',
    [placeId]
  );

  const name = item.title || 'Unknown';
  const category = item.categoryName || (item.categories?.[0]) || null;
  const address = item.address || null;
  const city = item.city || null;
  const state = item.state || null;
  const postalCode = item.postalCode || null;
  const countryCode = item.countryCode?.toLowerCase() || 'es';
  const phone = item.phone || null;
  const website = item.website || null;
  const rating = item.totalScore || null;
  const reviewsCount = item.reviewsCount || 0;
  const permanentlyClosed = item.permanentlyClosed || false;
  const lat = item.location?.lat || null;
  const lng = item.location?.lng || null;
  const googleMapsUrl = item.url || null;

  if (existing.rows.length > 0) {
    const id = existing.rows[0].id;
    await client.query(`
      UPDATE businesses SET
        name = $2, category = COALESCE($3, category), address = COALESCE($4, address),
        city = COALESCE($5, city), postal_code = COALESCE($6, postal_code),
        state = COALESCE($7, state), country_code = COALESCE($8, country_code),
        latitude = COALESCE($9, latitude), longitude = COALESCE($10, longitude),
        phone = COALESCE($11, phone), website = COALESCE($12, website),
        rating = COALESCE($13, rating), reviews_count = COALESCE($14, reviews_count),
        permanently_closed = COALESCE($15, permanently_closed),
        google_maps_url = COALESCE($16, google_maps_url),
        last_scraped_at = NOW(), last_updated_at = NOW(), scrape_count = scrape_count + 1
      WHERE id = $1
    `, [id, name, category, address, city, postalCode, state, countryCode, lat, lng,
        phone, website, rating, reviewsCount, permanentlyClosed, googleMapsUrl]);
    return { id, action: 'updated' };
  } else {
    const result = await client.query(`
      INSERT INTO businesses (
        place_id, name, category, address, city, postal_code, state, country_code,
        latitude, longitude, phone, website, rating, reviews_count, permanently_closed,
        google_maps_url, last_scraped_at, scrape_count, lifecycle_stage, lifecycle_updated_at,
        ready_for_enrichment, data_source, place_id_source, times_reused,
        last_discovery_crawl, next_discovery_crawl, discovery_crawl_count
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        NOW(), 1, 'lead', NOW(), FALSE, 'scraper', 'scraped', 0,
        NOW(), NOW() + INTERVAL '45 days', 1
      ) RETURNING id
    `, [placeId, name, category, address, city, postalCode, state, countryCode,
        lat, lng, phone, website, rating, reviewsCount, permanentlyClosed, googleMapsUrl]);
    return { id: result.rows[0].id, action: 'inserted' };
  }
}

async function main() {
  console.log(`\n📥 Importing Apify run: ${RUN_ID}\n`);

  let items;
  try {
    items = await fetchRunItems(RUN_ID);
    console.log(`✅ Fetched ${items.length} items from Apify\n`);
  } catch (err) {
    console.error('❌ Failed to fetch from Apify:', err.message);
    process.exit(1);
  }

  const client = await pool.connect();
  let inserted = 0, updated = 0, skipped = 0;

  try {
    for (const item of items) {
      if (!item.placeId) { skipped++; continue; }
      try {
        const result = await upsertBusiness(client, item);
        if (result?.action === 'inserted') inserted++;
        else if (result?.action === 'updated') updated++;
        process.stdout.write(`\r  Progress: ${inserted + updated + skipped}/${items.length} (${inserted} new, ${updated} updated, ${skipped} skipped)`);
      } catch (err) {
        console.error(`\n  ⚠️  Failed to upsert "${item.title}": ${err.message}`);
        skipped++;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n\n✅ Import complete!`);
  console.log(`   🆕 Inserted: ${inserted}`);
  console.log(`   🔄 Updated:  ${updated}`);
  console.log(`   ⏭️  Skipped:  ${skipped}`);
  console.log(`   📊 Total:    ${items.length}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
