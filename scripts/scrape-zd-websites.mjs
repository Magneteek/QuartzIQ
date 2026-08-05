/**
 * Scrape ZD websites directly for official contact + director name
 * Overwrites enrichment data with verified public info from websites
 */

import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;

const ZD_IDS = [
  '9a7184f6-f3ca-407d-aa25-b408d853dd53',
  '4c12b449-a630-42ce-b9cd-143bb90d0332',
  '065013be-a628-4eb3-9d8c-069c89e4f193',
  '51f7be11-6030-44a1-8e7e-fbb2d4a48f12',
  '4eb3132b-c3bd-4698-ae38-39cbcea544a5',
  '8d6de092-e103-405a-b1e4-568aa4bb0fc9',
  '39369671-583f-4cab-a15f-8a308b861a3e',
  '93d83e03-8c59-4983-923b-2cfa4edbdf11',
  '4081aea4-eeff-41d8-9b74-beef605a878b',
  'b144761e-0640-4da3-8ca5-69ba3d19a64d',
  '5af76add-9e25-42a2-9954-3c23ae1fd063',
  '6e9cd870-e6aa-4a91-a26b-aef2d3b86a12',
  '9fcfdc55-6a3d-47e1-beaf-1bd2a7b03c81',
  'd1a30027-8638-4b36-a551-9edb2543090e',
];

// Pages to try per domain (contact/about pages likely to have director + email)
const CONTACT_PATHS = ['/', '/kontakt', '/o-nas', '/predstavitev', '/vodstvo', '/contact', '/about'];

async function firecrawlScrape(url) {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_KEY}` },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}`);
  const data = await res.json();
  return data.data?.markdown || '';
}

async function extractWithClaude(markdown, zdName) {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `You are extracting contact info from a Slovenian public health center (zdravstveni dom) website.

Institution: ${zdName}

Website content:
${markdown.slice(0, 6000)}

Extract:
1. Director name (direktor/direktorica) - full name
2. Director title in Slovenian
3. Official/public contact email (info@, uprava@, tajnistvo@, or similar institutional email - NOT personal emails)
4. General phone number

Return JSON only, no explanation:
{
  "director_name": "...",
  "director_title": "...",
  "official_email": "...",
  "phone": "..."
}

If not found, use null for that field.`
    }]
  });

  try {
    const text = msg.content[0].text.trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

async function researchZD(id, name, website) {
  if (!website) return null;

  const baseUrl = new URL(website).origin;
  let bestResult = null;

  // Try contact/about pages first, then homepage
  const urlsToTry = [
    website,
    ...CONTACT_PATHS.map(p => `${baseUrl}${p}`).filter(u => u !== website)
  ].slice(0, 4); // max 4 pages per ZD

  for (const url of urlsToTry) {
    try {
      console.log(`  📄 Scraping ${url}`);
      const markdown = await firecrawlScrape(url);
      if (!markdown || markdown.length < 100) continue;

      const result = await extractWithClaude(markdown, name);
      if (!result) continue;

      // Keep result if it has more info than previous
      if (!bestResult ||
          (result.official_email && !bestResult.official_email) ||
          (result.director_name && !bestResult.director_name)) {
        bestResult = result;
      }

      // Stop if we have everything
      if (bestResult.director_name && bestResult.official_email) break;

      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.log(`  ⚠️  Failed ${url}: ${e.message}`);
    }
  }

  return bestResult;
}

async function main() {
  console.log('🏥 Scraping ZD websites for official contacts...\n');

  const businesses = await pool.query(
    `SELECT id, name, website FROM businesses WHERE id = ANY($1::uuid[]) AND website IS NOT NULL ORDER BY name`,
    [ZD_IDS]
  );

  const results = [];

  for (const b of businesses.rows) {
    console.log(`\n[${results.length + 1}/${businesses.rowCount}] ${b.name}`);
    console.log(`  🌐 ${b.website}`);

    const info = await researchZD(b.id, b.name, b.website);

    if (info) {
      console.log(`  ✅ Director: ${info.director_name || 'not found'}`);
      console.log(`  ✅ Email:    ${info.official_email || 'not found'}`);
      console.log(`  ✅ Phone:    ${info.phone || 'not found'}`);

      // Update contact_enrichments with verified data
      await pool.query(`
        INSERT INTO contact_enrichments (
          business_id, owner_name, title, email, phone,
          enrichment_status, enrichment_source, confidence_score
        ) VALUES ($1, $2, $3, $4, $5, 'enriched', 'website_scrape', 0.9)
        ON CONFLICT (business_id) DO UPDATE SET
          owner_name = COALESCE($2, contact_enrichments.owner_name),
          title = COALESCE($3, contact_enrichments.title),
          email = COALESCE($4, contact_enrichments.email),
          phone = COALESCE($5, contact_enrichments.phone),
          enrichment_source = 'website_scrape',
          confidence_score = 0.9,
          updated_at = NOW()
      `, [b.id, info.director_name, info.director_title, info.official_email, info.phone]);

      results.push({ name: b.name, ...info });
    } else {
      console.log(`  ❌ Could not extract info`);
      results.push({ name: b.name, director_name: null, official_email: null });
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('══════════════════════════════════════════════════');
  results.forEach(r => {
    console.log(`${r.name}`);
    console.log(`  👤 ${r.director_name || '—'}  |  📧 ${r.official_email || '—'}`);
  });

  const withEmail = results.filter(r => r.official_email).length;
  const withName = results.filter(r => r.director_name).length;
  console.log(`\n✅ Emails found: ${withEmail}/${results.length}`);
  console.log(`✅ Director names: ${withName}/${results.length}`);

  pool.end();
}

main().catch(console.error);
