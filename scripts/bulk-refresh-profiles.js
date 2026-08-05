/**
 * Bulk Profile Refresh
 *
 * Fetches fresh Google Maps data for all stored businesses matching a filter,
 * using place_ids directly (no search/discovery — fast & cheap).
 *
 * One Apify run with N startUrls → updates reviews_count, rating, phone,
 * website, address, permanently_closed in DB.
 *
 * Usage:
 *   node scripts/bulk-refresh-profiles.js
 *   node scripts/bulk-refresh-profiles.js --filter tattoo --state canarias
 *   node scripts/bulk-refresh-profiles.js --filter tattoo --state canarias --dry-run
 *   node scripts/bulk-refresh-profiles.js --filter tattoo --state canarias --limit 50
 */

require('dotenv').config({ path: '.env.local' });

const { Pool } = require('pg');

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

if (!APIFY_TOKEN) { console.error('Missing APIFY_API_TOKEN'); process.exit(1); }
if (!DATABASE_URL) { console.error('Missing DATABASE_URL'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

// --- CLI args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
// --filter accepts comma-separated keywords: tattoo,ink
const filterArg = (args[args.indexOf('--filter') + 1] || 'tattoo,ink').split(',').map(s => s.trim());
const stateArg  = args[args.indexOf('--state')  + 1] || 'canarias';
const limitArg  = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null;

const STATE_FILTERS = {
  canarias: ["Las Palmas", "Santa Cruz de Tenerife"],
};

async function runApify(startUrls) {
  const input = {
    startUrls,
    maxCrawledPlacesPerSearch: 1,
    language: 'en',
    includeImages: false,
    includeReviews: false,
  };

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  );

  if (!runRes.ok) {
    const text = await runRes.text();
    throw new Error(`Apify start error ${runRes.status}: ${text.slice(0, 300)}`);
  }

  const runData = await runRes.json();
  const runId = runData.data?.id;
  const datasetId = runData.data?.defaultDatasetId;
  if (!runId) throw new Error('No run ID returned from Apify');

  console.log(`\n  Apify run started: ${runId}`);
  console.log(`  Dashboard: https://console.apify.com/actors/runs/${runId}`);

  // Poll until done
  const maxWaitMs = 40 * 60 * 1000; // 40 min
  const pollIntervalMs = 15_000;
  const pollStart = Date.now();
  let lastStatus = '';

  while (Date.now() - pollStart < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const statusData = await statusRes.json();
    const status = statusData.data?.status;
    const stats = statusData.data?.stats || {};

    if (status !== lastStatus) {
      process.stdout.write(`\n  Status: ${status}`);
      lastStatus = status;
    } else {
      process.stdout.write('.');
    }

    if (status === 'SUCCEEDED') {
      process.stdout.write('\n');
      console.log(`  Finished in ${Math.round((Date.now() - pollStart) / 1000)}s`);
      break;
    }
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(`Apify run ended with status: ${status}`);
    }
  }

  // Fetch results (paginated if large)
  const results = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&limit=${pageSize}&offset=${offset}`
    );
    if (!dataRes.ok) throw new Error(`Failed to fetch dataset: ${dataRes.statusText}`);
    const page = await dataRes.json();
    if (!page.length) break;
    results.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return results;
}

async function updateBusiness(client, item) {
  if (!item.placeId) return 'skipped';

  const updates = {};
  if (item.totalScore   != null) updates.rating             = item.totalScore;
  if (item.reviewsCount != null) updates.reviews_count      = item.reviewsCount;
  if (item.phone)                updates.phone              = item.phone;
  if (item.website)              updates.website            = item.website;
  if (item.address)              updates.address            = item.address;
  if (item.city)                 updates.city               = item.city;
  if (item.state)                updates.state              = item.state;
  if (item.postalCode)           updates.postal_code        = item.postalCode;
  if (item.countryCode)          updates.country_code       = item.countryCode.toLowerCase();
  if (item.permanentlyClosed != null) updates.permanently_closed = item.permanentlyClosed;

  if (Object.keys(updates).length === 0) return 'no-data';

  const setClauses = Object.keys(updates).map((col, i) => `${col} = $${i + 2}`);
  setClauses.push('last_scraped_at = NOW()', 'last_updated_at = NOW()', 'scrape_count = scrape_count + 1');

  await client.query(
    `UPDATE businesses SET ${setClauses.join(', ')} WHERE place_id = $1`,
    [item.placeId, ...Object.values(updates)]
  );

  return 'updated';
}

async function main() {
  console.log('=== Bulk Profile Refresh ===');
  console.log(`  Filter:  ${filterArg.join(' OR ')}`);
  console.log(`  State:   ${stateArg}`);
  if (limitArg) console.log(`  Limit:   ${limitArg}`);
  if (DRY_RUN)  console.log('  DRY RUN — no Apify calls or DB writes');

  const client = await pool.connect();

  try {
    // Build query — support multiple filter keywords (OR)
    const states = STATE_FILTERS[stateArg.toLowerCase()];
    const keywordCondition = filterArg
      .map((_, i) => `(name ILIKE $${i + 1} OR category ILIKE $${i + 1})`)
      .join(' OR ');
    const keywordParams = filterArg.map(k => `%${k}%`);

    let query, params;

    if (states) {
      const stateParam = `$${filterArg.length + 1}`;
      query = `
        SELECT id, place_id, name, city, state, reviews_count, rating
        FROM businesses
        WHERE (${keywordCondition})
          AND country_code = 'es'
          AND state = ANY(${stateParam}::text[])
        ORDER BY reviews_count DESC
        ${limitArg ? `LIMIT ${limitArg}` : ''}
      `;
      params = [...keywordParams, states];
    } else {
      query = `
        SELECT id, place_id, name, city, state, reviews_count, rating
        FROM businesses
        WHERE (${keywordCondition})
          AND country_code = 'es'
        ORDER BY reviews_count DESC
        ${limitArg ? `LIMIT ${limitArg}` : ''}
      `;
      params = keywordParams;
    }

    const { rows: businesses } = await client.query(query, params);

    if (businesses.length === 0) {
      console.log('\nNo businesses found matching filters.');
      return;
    }

    console.log(`\nFound ${businesses.length} businesses to refresh:`);
    // City summary
    const cityCounts = {};
    businesses.forEach(b => { cityCounts[b.city || '(no city)'] = (cityCounts[b.city || '(no city)'] || 0) + 1; });
    Object.entries(cityCounts).sort((a,b) => b[1]-a[1]).slice(0, 10).forEach(([city, count]) => {
      console.log(`  ${city}: ${count}`);
    });
    if (Object.keys(cityCounts).length > 10) console.log(`  ... and ${Object.keys(cityCounts).length - 10} more cities`);

    if (DRY_RUN) {
      console.log('\nDry run complete. Remove --dry-run to execute.');
      return;
    }

    // Build startUrls
    const startUrls = businesses.map(b => ({
      url: `https://www.google.com/maps/place/?q=place_id:${b.place_id}`
    }));

    console.log(`\nStarting Apify run with ${startUrls.length} place URLs...`);
    const results = await runApify(startUrls);

    console.log(`\nApify returned ${results.length} results. Updating DB...`);

    let updated = 0, skipped = 0, noData = 0, closed = 0;

    for (const item of results) {
      const outcome = await updateBusiness(client, item);
      if (outcome === 'updated') {
        updated++;
        if (item.permanentlyClosed) closed++;
      } else if (outcome === 'skipped') {
        skipped++;
      } else {
        noData++;
      }
    }

    const notReturned = businesses.length - results.length;

    console.log('\n=== Results ===');
    console.log(`  Businesses queried:  ${businesses.length}`);
    console.log(`  Apify results:       ${results.length}`);
    console.log(`  Updated in DB:       ${updated}`);
    console.log(`  Not returned:        ${notReturned} (deleted from Google Maps or timed out)`);
    console.log(`  Permanently closed:  ${closed}`);
    console.log(`  Skipped (no placeId):${skipped}`);

    // Show businesses with biggest review count changes
    if (updated > 0) {
      console.log('\nSpot-checking review count changes (top 10 by new count):');
      const oldMap = Object.fromEntries(businesses.map(b => [b.place_id, b]));
      const changes = results
        .filter(r => r.placeId && oldMap[r.placeId] && r.reviewsCount != null)
        .map(r => ({
          name: r.title,
          old: oldMap[r.placeId].reviews_count,
          new: r.reviewsCount,
          diff: r.reviewsCount - (oldMap[r.placeId].reviews_count || 0),
        }))
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
        .slice(0, 10);

      changes.forEach(c => {
        const arrow = c.diff > 0 ? '▲' : c.diff < 0 ? '▼' : '=';
        console.log(`  ${arrow} ${c.name}: ${c.old} → ${c.new} (${c.diff > 0 ? '+' : ''}${c.diff})`);
      });
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
