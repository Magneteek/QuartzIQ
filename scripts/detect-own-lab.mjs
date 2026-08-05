/**
 * Detect dental clinics with own in-house lab
 * Scrapes websites and asks Claude if they have their own dental lab
 * Marks them with lead_score < 50 and va_notes for Dentro disqualification
 */

import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;

const IDS = process.env.BUSINESS_IDS.split(',');

async function scrape(url) {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_KEY}` },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  return data.data?.markdown || '';
}

async function hasOwnLab(markdown, name) {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Does this dental clinic have their own in-house dental laboratory (lasten zobotehnični laboratorij, lastni laboratorij, CEREC, in-house CAD/CAM milling)?

Clinic: ${name}

Website content:
${markdown.slice(0, 3000)}

Reply with JSON only: {"has_own_lab": true/false, "reason": "brief explanation or null"}`
    }]
  });
  try {
    return JSON.parse(msg.content[0].text.match(/\{[\s\S]*\}/)?.[0]);
  } catch { return null; }
}

async function main() {
  const businesses = await pool.query(
    `SELECT id, name, website FROM businesses WHERE id = ANY($1::uuid[]) AND website IS NOT NULL ORDER BY name`,
    [IDS]
  );

  console.log(`Checking ${businesses.rowCount} websites for own lab...\n`);

  let flagged = 0;
  let checked = 0;

  for (const b of businesses.rows) {
    try {
      const md = await scrape(b.website);
      if (!md || md.length < 100) { checked++; continue; }

      const result = await hasOwnLab(md, b.name);
      checked++;

      if (result?.has_own_lab) {
        flagged++;
        // Lower lead score below 50 and add note
        await pool.query(
          `UPDATE businesses SET lead_score = 20, va_notes = $1 WHERE id = $2`,
          [`[Dentro: DQ] Has own lab - ${result.reason}`, b.id]
        );
        console.log(`❌ OWN LAB: ${b.name} — ${result.reason}`);
      } else {
        process.stdout.write('.');
      }
    } catch (e) {
      process.stdout.write('x');
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n\nDone. Checked: ${checked}, Flagged as own-lab: ${flagged}`);
  pool.end();
}

main().catch(console.error);
