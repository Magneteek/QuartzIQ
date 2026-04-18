/**
 * Batch Spain Dentist Scraper
 * Scrapes dentists city-by-city across Spain using Nominatim geocoding + Apify bbox
 *
 * Usage:
 *   node scripts/batch-spain-dentists.js               # All 50 provincial capitals
 *   node scripts/batch-spain-dentists.js --top20        # Top 20 cities only
 *   node scripts/batch-spain-dentists.js --dry-run      # Preview only, no Apify calls
 *   node scripts/batch-spain-dentists.js --resume 10    # Skip first 10 cities (resume)
 */

const { Pool } = require('pg');

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const DELAY_BETWEEN_CITIES_MS = 5000; // 5s between cities to avoid rate limits

// Spanish cities + Canary Islands, ordered by population/ROI
const ALL_CITIES = [
  // === TOP TIER — major cities ===
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
  // === MID TIER — 200K-350K ===
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
  // === TOP 30 — 150K-220K ===
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
  // === CANARY ISLANDS — full island bbox ===
  { name: 'Tenerife',              query: 'Tenerife, Spain' },
  { name: 'Gran Canaria',          query: 'Gran Canaria, Spain' },
  { name: 'Lanzarote',             query: 'Lanzarote, Spain' },
  // === PROVINCIAL CAPITALS — remaining ===
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
];

const TOP20_CITIES = ALL_CITIES.slice(0, 20);
const TOP30_CITIES = ALL_CITIES.slice(0, 30);

// Parse CLI args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isTop20 = args.includes('--top20');
const isTop30 = args.includes('--top30');
const resumeIdx = args.includes('--resume') ? parseInt(args[args.indexOf('--resume') + 1]) || 0 : 0;

const CITIES = isTop20 ? TOP20_CITIES : isTop30 ? TOP30_CITIES : ALL_CITIES;
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

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

async function runApifySearch(cityName, bbox, maxResults = 200) {
  const [south, north, west, east] = bbox;
  const input = {
    searchStringsArray: ['dentista'],
    maxCrawledPlacesPerSearch: maxResults,
    language: 'es',
    countryCode: 'es',
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

  console.log(`  📍 Bbox: S=${south.toFixed(3)}, N=${north.toFixed(3)}, W=${west.toFixed(3)}, E=${east.toFixed(3)}`);

  const url = `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=300`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(360000) // 6 min timeout
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function upsertBusiness(client, item) {
  if (!item.placeId) return null;

  const existing = await client.query('SELECT id FROM businesses WHERE place_id = $1', [item.placeId]);

  // Strip large fields from raw_data to keep storage lean
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
    (item.countryCode || 'ES').toLowerCase(),
    item.location?.lat || null,
    item.location?.lng || null,
    item.phone || null,
    item.website || null,
    item.email || item.emailContacts?.[0] || null,   // email from Google listing
    item.totalScore || null,
    item.reviewsCount || 0,
    item.permanentlyClosed || false,
    item.placeId ? `https://www.google.com/maps/place/?q=place_id:${item.placeId}` : (item.url || null),
    JSON.stringify(rawData),                          // raw_data
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

async function saveSearchSession(cityName, businessesFound) {
  await pool.query(
    `INSERT INTO search_sessions (category, location, country_code, businesses_found) VALUES ($1, $2, $3, $4)`,
    ['dentist', cityName, 'es', businessesFound]
  );
}

async function processCIty(city, index) {
  console.log(`\n[${ String(index + 1).padStart(2, '0')}/${CITIES.length}] ${city.name}`);

  // Geocode
  let geo;
  try {
    geo = await geocodeCity(city.query);
    console.log(`  🌍 Geocoded: ${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`);
  } catch (err) {
    console.error(`  ❌ Geocoding failed: ${err.message}`);
    return { city: city.name, status: 'geocode_failed', inserted: 0, updated: 0 };
  }

  if (isDryRun) {
    console.log(`  🔍 DRY RUN - would search with bbox`);
    return { city: city.name, status: 'dry_run', inserted: 0, updated: 0 };
  }

  // Run Apify
  let items;
  try {
    console.log(`  🔄 Running Apify search...`);
    items = await runApifySearch(city.name, geo.bbox);
    console.log(`  ✅ Apify returned ${items.length} results`);
  } catch (err) {
    console.error(`  ❌ Apify failed: ${err.message}`);
    return { city: city.name, status: 'apify_failed', inserted: 0, updated: 0 };
  }

  // Save to DB
  const client = await pool.connect();
  let inserted = 0, updated = 0, skipped = 0;
  try {
    for (const item of items) {
      if (!item.placeId) { skipped++; continue; }
      try {
        const action = await upsertBusiness(client, item);
        if (action === 'inserted') inserted++;
        else if (action === 'updated') updated++;
      } catch (err) {
        skipped++;
      }
    }
    await saveSearchSession(city.name, items.length);
  } finally {
    client.release();
  }

  console.log(`  💾 DB: ${inserted} new, ${updated} updated, ${skipped} skipped`);
  return { city: city.name, status: 'success', inserted, updated, items: items.length };
}

async function main() {
  console.log('\n🇪🇸 Spain Dentist Batch Scraper');
  console.log('═'.repeat(50));
  const modeLabel = isTop20 ? 'top 20' : isTop30 ? 'top 30' : 'all 50 provinces';
  console.log(`Cities: ${CITIES.length} (${modeLabel})`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  if (resumeIdx > 0) console.log(`Resuming from city #${resumeIdx + 1}`);
  console.log('═'.repeat(50));

  const results = [];
  const citiesToProcess = CITIES.slice(resumeIdx);

  for (let i = 0; i < citiesToProcess.length; i++) {
    const city = citiesToProcess[i];
    const globalIdx = resumeIdx + i;
    const result = await processCIty(city, globalIdx);
    results.push(result);

    // Delay between cities (except last)
    if (i < citiesToProcess.length - 1 && !isDryRun) {
      console.log(`  ⏳ Waiting ${DELAY_BETWEEN_CITIES_MS / 1000}s before next city...`);
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_CITIES_MS));
    }
  }

  // Summary
  const successful = results.filter(r => r.status === 'success');
  const totalInserted = results.reduce((s, r) => s + (r.inserted || 0), 0);
  const totalUpdated = results.reduce((s, r) => s + (r.updated || 0), 0);
  const totalItems = results.reduce((s, r) => s + (r.items || 0), 0);

  console.log('\n' + '═'.repeat(50));
  console.log('📊 BATCH COMPLETE');
  console.log('═'.repeat(50));
  console.log(`  ✅ Cities processed: ${successful.length}/${CITIES.length}`);
  console.log(`  🏢 Total businesses found: ${totalItems}`);
  console.log(`  🆕 New records: ${totalInserted}`);
  console.log(`  🔄 Updated records: ${totalUpdated}`);
  console.log(`  💰 Est. Apify cost: ~$${(totalItems * 0.006).toFixed(2)}`);

  const failed = results.filter(r => r.status !== 'success' && r.status !== 'dry_run');
  if (failed.length > 0) {
    console.log(`\n  ❌ Failed cities (${failed.length}):`);
    failed.forEach(r => console.log(`     - ${r.city}: ${r.status}`));
    console.log(`\n  To retry failed cities, re-run with --resume ${resumeIdx + results.findIndex(r => r.status !== 'success')}`);
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
