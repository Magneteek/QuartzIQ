/**
 * Tattoo Studio Gap-Fill Scraper
 *
 * The original "estudio de tatuajes" search only matches Google's category field,
 * which misses ~17% of real tattoo studios/artists that Google left uncategorized
 * or filed under an adjacent category (piercing, tattoo removal). This script
 * re-searches with broader terms ("tatuajes", "tattoo") and applies a name/category
 * filter BEFORE insert, so only genuine tattoo-related businesses ever hit the DB —
 * no post-hoc cleanup needed.
 *
 * Filter logic (derived from manual review of Vigo + Málaga test runs):
 *   KEEP if category contains "tatuaj" or "tattoo" (covers studios, piercing+tattoo
 *        combos, removal services, "Tattoo artist") — excludes pure piercing shops,
 *        aesthetics centers, etc.
 *   KEEP if category is null/empty AND business name contains "tattoo" or "tatuaj"
 *        (covers the ~17% Google left uncategorized — very common in this industry
 *        with names like "Buxotattoo", "Ferrarink tattoo")
 *   REJECT everything else (bars, shops, restaurants etc. that fuzzy-matched the
 *        broad search term).
 *
 * Usage:
 *   node scripts/tattoo-gap-fill.js --preset spain-all --dry-run
 *   node scripts/tattoo-gap-fill.js --preset spain-all
 *   node scripts/tattoo-gap-fill.js --cities "Madrid,Barcelona" --grid 2
 *   node scripts/tattoo-gap-fill.js --preset spain-all --resume 10
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const { Pool } = require('pg');

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const DELAY_BETWEEN_CITIES_MS = 5000;
const DELAY_BETWEEN_TERMS_MS = 3000;
const TERMS = ['tatuajes', 'tattoo'];

// City presets (same list as batch-scraper.js spain-all preset)
const PRESETS = {
  'spain-all': [
    { name: 'Madrid',                query: 'Madrid, Spain' },
    { name: 'Barcelona',             query: 'Barcelona, Spain' },
    { name: 'Valencia',              query: 'Valencia, Spain' },
    { name: 'Sevilla',               query: 'Sevilla, Spain' },
    { name: 'Zaragoza',              query: 'Zaragoza, Spain' },
    { name: 'Málaga',                query: 'Málaga, Spain' },
    { name: 'Murcia',                query: 'Murcia, Spain' },
    { name: 'Palma',                 query: 'Palma de Mallorca, Spain' },
    { name: 'Bilbao',                query: 'Bilbao, Spain' },
    { name: 'Alicante',              query: 'Alicante, Spain' },
    { name: 'Córdoba',               query: 'Córdoba, Spain' },
    { name: 'Valladolid',            query: 'Valladolid, Spain' },
    { name: 'Vigo',                  query: 'Vigo, Spain' },
    { name: 'Gijón',                 query: 'Gijón, Spain' },
    { name: 'Granada',               query: 'Granada, Spain' },
    { name: 'A Coruña',              query: 'A Coruña, Spain' },
    { name: 'Vitoria-Gasteiz',       query: 'Vitoria-Gasteiz, Spain' },
    { name: 'Elche',                 query: 'Elche, Spain' },
    { name: 'Oviedo',                query: 'Oviedo, Spain' },
    { name: 'Badalona',              query: 'Badalona, Spain' },
    { name: 'Cartagena',             query: 'Cartagena, Spain' },
    { name: 'Jerez de la Frontera',  query: 'Jerez de la Frontera, Spain' },
    { name: 'Sabadell',              query: 'Sabadell, Spain' },
    { name: 'Alcalá de Henares',     query: 'Alcalá de Henares, Spain' },
    { name: 'San Sebastián',         query: 'San Sebastián, Spain' },
    { name: 'Pamplona',              query: 'Pamplona, Spain' },
    { name: 'Almería',               query: 'Almería, Spain' },
    { name: 'Castellón de la Plana', query: 'Castellón de la Plana, Spain' },
    { name: 'Burgos',                query: 'Burgos, Spain' },
    { name: 'Santander',             query: 'Santander, Spain' },
    { name: 'Tenerife',              query: 'Tenerife, Spain' },
    { name: 'Gran Canaria',          query: 'Gran Canaria, Spain' },
    { name: 'Lanzarote',             query: 'Lanzarote, Spain' },
    { name: 'Albacete',              query: 'Albacete, Spain' },
    { name: 'Salamanca',             query: 'Salamanca, Spain' },
    { name: 'Logroño',               query: 'Logroño, Spain' },
    { name: 'Badajoz',               query: 'Badajoz, Spain' },
    { name: 'Huelva',                query: 'Huelva, Spain' },
    { name: 'Lleida',                query: 'Lleida, Spain' },
    { name: 'Tarragona',             query: 'Tarragona, Spain' },
    { name: 'Jaén',                  query: 'Jaén, Spain' },
    { name: 'León',                  query: 'León, Spain' },
    { name: 'Cádiz',                 query: 'Cádiz, Spain' },
    { name: 'Girona',                query: 'Girona, Spain' },
    { name: 'Toledo',                query: 'Toledo, Spain' },
    { name: 'Ciudad Real',           query: 'Ciudad Real, Spain' },
    { name: 'Cuenca',                query: 'Cuenca, Spain' },
  ],
  'canarias': [
    { name: 'Tenerife',       query: 'Tenerife, Spain' },
    { name: 'Gran Canaria',   query: 'Gran Canaria, Spain' },
    { name: 'Lanzarote',      query: 'Lanzarote, Spain' },
    { name: 'Fuerteventura',  query: 'Fuerteventura, Spain' },
    { name: 'La Palma',       query: 'La Palma, Canary Islands, Spain' },
    { name: 'La Gomera',      query: 'La Gomera, Spain' },
    { name: 'El Hierro',      query: 'El Hierro, Spain' },
  ],
};
PRESETS['spain-top20'] = PRESETS['spain-all'].slice(0, 20);

// Parse CLI args
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

const preset = getArg('--preset');
const citiesArg = getArg('--cities');
const countryCode = getArg('--country') || 'es';
const language = getArg('--language') || 'es';
const maxResults = parseInt(getArg('--max-results') || '200');
const resumeIdx = parseInt(getArg('--resume') || '0');
const gridSize = parseInt(getArg('--grid') || '1');
const isDryRun = args.includes('--dry-run');

let CITIES = [];
if (preset) {
  CITIES = PRESETS[preset];
  if (!CITIES) {
    console.error(`❌ Unknown preset "${preset}". Available: ${Object.keys(PRESETS).join(', ')}`);
    process.exit(1);
  }
} else if (citiesArg) {
  CITIES = citiesArg.split(',').map(c => c.trim()).map(c => ({ name: c, query: c }));
} else {
  console.error('❌ Either --preset or --cities is required.');
  console.error('   Examples:');
  console.error('     --preset spain-all');
  console.error('     --cities "Madrid,Barcelona" --grid 2');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

function isTattooRelated(item) {
  const category = (item.categoryName || item.categories?.[0] || '').toLowerCase();
  const name = (item.title || '').toLowerCase();
  if (category) {
    return category.includes('tatuaj') || category.includes('tattoo');
  }
  return name.includes('tattoo') || name.includes('tatuaj');
}

function subdivideGrid(bbox, n) {
  const [south, north, west, east] = bbox;
  const latStep = (north - south) / n;
  const lngStep = (east - west) / n;
  const cells = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      cells.push([
        south + row * latStep,
        south + (row + 1) * latStep,
        west + col * lngStep,
        west + (col + 1) * lngStep,
      ]);
    }
  }
  return cells;
}

async function geocodeCity(query) {
  await new Promise(r => setTimeout(r, 1100)); // Nominatim rate limit: 1 req/sec
  const params = new URLSearchParams({ q: query, format: 'json', limit: '1' });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'QuartzIQ/1.0' }
  });
  if (!res.ok) throw new Error(`Nominatim error: ${res.statusText}`);
  const data = await res.json();
  if (!data.length) throw new Error(`No geocoding result for: ${query}`);
  const { lat, lon, boundingbox } = data[0];
  return {
    lat: parseFloat(lat),
    lng: parseFloat(lon),
    bbox: [parseFloat(boundingbox[0]), parseFloat(boundingbox[1]), parseFloat(boundingbox[2]), parseFloat(boundingbox[3])]
  };
}

async function runApifySearch(term, bbox) {
  const [south, north, west, east] = bbox;
  const input = {
    searchStringsArray: [term],
    maxCrawledPlacesPerSearch: maxResults,
    language,
    countryCode,
    includeImages: false,
    includeReviews: false,
    includeWebsiteData: false,
    scrapeContactInfo: false,
    scrapeSocialMedia: false,
    maxPagesPerQuery: 0,
    customGeolocation: {
      type: 'Polygon',
      coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]]
    },
    searchMatching: 'all',
    website: 'allPlaces',
    skipClosedPlaces: false,
  };

  const runUrl = `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${APIFY_TOKEN}`;
  const runRes = await fetch(runUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!runRes.ok) {
    const text = await runRes.text();
    throw new Error(`Apify error ${runRes.status}: ${text.slice(0, 200)}`);
  }

  const runData = await runRes.json();
  const runId = runData.data?.id;
  if (!runId) throw new Error('No run ID returned from Apify');

  console.log(`    ⏳ Apify run started (${runId}), polling...`);

  const pollStart = Date.now();
  const maxWait = 20 * 60 * 1000;
  while (Date.now() - pollStart < maxWait) {
    await new Promise(r => setTimeout(r, 10000));
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const statusData = await statusRes.json();
    const status = statusData.data?.status;
    if (status === 'SUCCEEDED') break;
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify run ${status}`);
    }
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  const datasetId = runData.data?.defaultDatasetId;
  const dataRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&limit=1000`);
  if (!dataRes.ok) throw new Error(`Failed to fetch dataset: ${dataRes.statusText}`);
  return dataRes.json();
}

async function upsertBusiness(client, item) {
  if (!item.placeId) return null;

  const existing = await client.query('SELECT id FROM businesses WHERE place_id = $1', [item.placeId]);

  const rawData = { ...item };
  delete rawData.reviews;
  delete rawData.images;
  delete rawData.imageCategories;
  delete rawData.additionalInfo;
  delete rawData.hotelAds;
  delete rawData.peopleAlsoSearch;
  delete rawData.placesTags;
  delete rawData.reviewsTags;

  const vals = [
    item.placeId,
    item.title || 'Unknown',
    item.categoryName || item.categories?.[0] || null,
    item.address || null,
    item.city || null,
    item.postalCode || null,
    item.state || null,
    (item.countryCode || countryCode.toUpperCase()).toLowerCase(),
    item.location?.lat || null,
    item.location?.lng || null,
    item.phone || null,
    item.website || null,
    item.email || item.emailContacts?.[0] || null,
    item.totalScore || null,
    item.reviewsCount || 0,
    item.permanentlyClosed || false,
    item.placeId ? `https://www.google.com/maps/place/?q=place_id:${item.placeId}` : (item.url || null),
    JSON.stringify(rawData),
  ];

  if (existing.rows.length > 0) {
    await client.query(`
      UPDATE businesses SET
        name=$2, category=COALESCE($3,category), address=COALESCE($4,address),
        city=COALESCE($5,city), postal_code=COALESCE($6,postal_code),
        state=COALESCE($7,state), country_code=COALESCE($8,country_code),
        latitude=COALESCE($9,latitude), longitude=COALESCE($10,longitude),
        phone=COALESCE($11,phone), website=COALESCE($12,website),
        email=COALESCE($13,email),
        rating=COALESCE($14,rating), reviews_count=COALESCE($15,reviews_count),
        permanently_closed=COALESCE($16,permanently_closed),
        google_maps_url=COALESCE($17,google_maps_url),
        raw_data=$18::jsonb,
        last_scraped_at=NOW(), last_updated_at=NOW(), scrape_count=scrape_count+1
      WHERE place_id=$1
    `, vals);
    return 'updated';
  } else {
    await client.query(`
      INSERT INTO businesses (
        place_id,name,category,address,city,postal_code,state,country_code,
        latitude,longitude,phone,website,email,rating,reviews_count,permanently_closed,
        google_maps_url,raw_data,last_scraped_at,scrape_count,lifecycle_stage,lifecycle_updated_at,
        ready_for_enrichment,data_source,place_id_source,times_reused,
        last_discovery_crawl,next_discovery_crawl,discovery_crawl_count
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,
        NOW(),1,'lead',NOW(),FALSE,'scraper','scraped',0,NOW(),NOW()+INTERVAL '45 days',1
      )
    `, vals);
    return 'inserted';
  }
}

async function processCity(city, index) {
  console.log(`\n[${String(index + 1).padStart(2, '0')}/${CITIES.length}] ${city.name}`);

  let geo;
  try {
    geo = await geocodeCity(city.query);
    console.log(`  🌍 Geocoded: ${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`);
  } catch (err) {
    console.error(`  ❌ Geocoding failed: ${err.message}`);
    return { city: city.name, status: 'geocode_failed', inserted: 0, updated: 0, kept: 0, rejected: 0 };
  }

  const cells = gridSize > 1 ? subdivideGrid(geo.bbox, gridSize) : [geo.bbox];

  if (isDryRun) {
    const gridLabel = gridSize > 1 ? ` (${gridSize}×${gridSize} grid = ${cells.length} cells)` : '';
    console.log(`  🔍 DRY RUN - would search terms [${TERMS.join(', ')}]${gridLabel}`);
    return { city: city.name, status: 'dry_run', inserted: 0, updated: 0, kept: 0, rejected: 0 };
  }

  // Collect kept items across all terms/cells, deduplicated by placeId
  const keptMap = new Map();
  let rawTotal = 0, rejectedTotal = 0;
  let anySuccess = false;

  for (let t = 0; t < TERMS.length; t++) {
    const term = TERMS[t];
    for (let c = 0; c < cells.length; c++) {
      const cellLabel = cells.length > 1 ? ` [cell ${c + 1}/${cells.length}]` : '';
      try {
        console.log(`  🔄 Searching "${term}"...${cellLabel}`);
        const items = await runApifySearch(term, cells[c]);
        rawTotal += items.length;
        let kept = 0, dup = 0, rejected = 0;
        for (const item of items) {
          if (!item.placeId) continue;
          if (isTattooRelated(item)) {
            if (!keptMap.has(item.placeId)) { keptMap.set(item.placeId, item); kept++; }
            else dup++;
          } else {
            rejected++;
          }
        }
        rejectedTotal += rejected;
        const dupNote = dup > 0 ? `, ${dup} already found` : '';
        console.log(`    ✅ ${items.length} raw → ${kept} new kept${dupNote}, ${rejected} rejected as noise`);
        anySuccess = true;
      } catch (err) {
        console.error(`    ❌ Apify failed${cellLabel}: ${err.message}`);
      }
      if (!(t === TERMS.length - 1 && c === cells.length - 1)) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_TERMS_MS));
      }
    }
  }

  if (!anySuccess) {
    return { city: city.name, status: 'apify_failed', inserted: 0, updated: 0, kept: 0, rejected: 0 };
  }

  const items = [...keptMap.values()];
  console.log(`  📊 Total genuine tattoo-related for ${city.name}: ${items.length} (${rejectedTotal} noise discarded, never inserted)`);

  const client = await pool.connect();
  let inserted = 0, updated = 0, skipped = 0;
  try {
    for (const item of items) {
      try {
        const action = await upsertBusiness(client, item);
        if (action === 'inserted') inserted++;
        else if (action === 'updated') updated++;
      } catch (err) {
        skipped++;
      }
    }
    await pool.query(
      `INSERT INTO search_sessions (category, location, country_code, businesses_found) VALUES ($1, $2, $3, $4)`,
      ['tattoo-gapfill', city.name, countryCode, items.length]
    );
  } finally {
    client.release();
  }

  console.log(`  💾 DB: ${inserted} new, ${updated} updated, ${skipped} skipped`);
  return { city: city.name, status: 'success', inserted, updated, kept: items.length, rejected: rejectedTotal, raw: rawTotal };
}

async function main() {
  console.log('\n🔍 QuartzIQ Tattoo Gap-Fill Scraper');
  console.log('═'.repeat(50));
  console.log(`Terms:   [${TERMS.join(', ')}] (broader than "estudio de tatuajes")`);
  console.log(`Cities:  ${CITIES.length} (${preset || 'custom'})`);
  console.log(`Country: ${countryCode.toUpperCase()} | Language: ${language}`);
  console.log(`Max results per cell: ${maxResults}`);
  if (gridSize > 1) console.log(`Grid: ${gridSize}×${gridSize} (${gridSize * gridSize} cells/city)`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  if (resumeIdx > 0) console.log(`Resuming from city #${resumeIdx + 1}`);
  console.log('═'.repeat(50));

  const results = [];
  const citiesToProcess = CITIES.slice(resumeIdx);

  for (let i = 0; i < citiesToProcess.length; i++) {
    const city = citiesToProcess[i];
    const globalIdx = resumeIdx + i;
    const result = await processCity(city, globalIdx);
    results.push(result);

    if (i < citiesToProcess.length - 1 && !isDryRun) {
      console.log(`  ⏳ Waiting ${DELAY_BETWEEN_CITIES_MS / 1000}s...`);
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_CITIES_MS));
    }
  }

  const successful = results.filter(r => r.status === 'success');
  const totalInserted = results.reduce((s, r) => s + (r.inserted || 0), 0);
  const totalUpdated = results.reduce((s, r) => s + (r.updated || 0), 0);
  const totalKept = results.reduce((s, r) => s + (r.kept || 0), 0);
  const totalRejected = results.reduce((s, r) => s + (r.rejected || 0), 0);
  const totalRaw = results.reduce((s, r) => s + (r.raw || 0), 0);

  console.log('\n' + '═'.repeat(50));
  console.log('📊 GAP-FILL COMPLETE');
  console.log('═'.repeat(50));
  console.log(`  ✅ Cities processed: ${successful.length}/${CITIES.length}`);
  console.log(`  📥 Raw Apify results: ${totalRaw}`);
  console.log(`  🚫 Rejected as noise (never inserted): ${totalRejected}`);
  console.log(`  🆕 New genuine records: ${totalInserted}`);
  console.log(`  🔄 Updated existing records: ${totalUpdated}`);
  console.log(`  💰 Est. Apify cost: ~$${(totalRaw * 0.006).toFixed(2)}`);

  const failed = results.filter(r => r.status !== 'success' && r.status !== 'dry_run');
  if (failed.length > 0) {
    console.log(`\n  ❌ Failed cities (${failed.length}):`);
    failed.forEach(r => console.log(`     - ${r.city}: ${r.status}`));
    const firstFailIdx = resumeIdx + results.findIndex(r => r.status !== 'success');
    console.log(`\n  To retry: node scripts/tattoo-gap-fill.js --preset ${preset || 'spain-all'} --resume ${firstFailIdx}`);
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
