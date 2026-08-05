/**
 * Export updated Canarias tattoo contacts.
 *
 * Reads the existing final export, cross-references with DB, and produces:
 *   1. canarias-tattoo-new-contacts.csv     — studios NOT in the previous export
 *   2. canarias-tattoo-all-updated.csv      — ALL studios with fresh review counts
 *                                             (re-import into GHL to update Reviews Count field)
 *
 * Usage:
 *   node scripts/export-canarias-tattoo-update.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
const fs   = require('fs').promises
const path = require('path')
const { Pool } = require('pg')

const EXISTING_EXPORT = path.join(__dirname, '../exports/canarias-tattoo-ghl-import-final.csv')
const OUT_NEW         = path.join(__dirname, '../exports/canarias-tattoo-new-contacts.csv')
const OUT_ALL         = path.join(__dirname, '../exports/canarias-tattoo-all-updated.csv')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ── Short Name logic (same as add-short-name-to-csv.js) ──────────────────────

const LOCATION_WORDS = [
  'lanzarote','tenerife','fuerteventura','gran canaria','la palma','la gomera','el hierro',
  'las palmas','canarias','canary islands','maspalomas','corralejo','arrecife',
  'puerto del carmen','costa teguise','san agustín','san agustin','playa blanca',
  'puerto de la cruz','puerto rico','los cristianos','playa de las americas',
  'la laguna','icod','mogán','mogan','ingenio','taco','fañabé','fanabe',
  'parque santiago','san eugenio','las canteras','primero de mayo',
  'caleta','beach','oasis','pueblo','puerto',
]
const GENERIC_SUFFIXES = [
  'tattoo studio','tattoo estudio','tattoo parlour','tattoo shop',
  'tattoo art gallery','tattoo art studio','tattoo art lab','tattoo gallery',
  'tattoo & piercing','tattoo y piercing','tattoo piercing','tattoo barber',
  'tattoo supply','tattoo supplies','tattoo supplier','tattoo artist',
  'tattoo family','tattoo',
  '& art gallery','& art studio','& art lab','& piercing','& barber','& supplies','& boutique',
  'art gallery','art studio','art lab',
  'studio','estudio','parlour','shop','galería','galeria','gallery',
  'salón','salon','barber shop','barber','supply','supplies','supplier',
  'atelier','showroom','boutique','store','piercing','ink',
]
const GENERIC_PREFIXES = ['estudio de tatuajes','estudio de tatuaje']
const STOP_WORDS = new Set(['el','la','los','las','de','del','the','a','al','un','una'])

function preserveCaps(original, result) {
  const capsWords = new Set()
  for (const w of original.split(/\s+/)) {
    const ascii = w.replace(/[^A-Za-z]/g, '')
    if (/^[A-Z]{2,4}$/.test(ascii)) capsWords.add(ascii)
  }
  if (capsWords.size === 0) return result
  return result.split(' ').map(word => {
    const ascii = word.replace(/[^A-Za-z]/g, '')
    return capsWords.has(ascii.toUpperCase()) ? word.replace(/[A-Za-z]+/, ascii.toUpperCase()) : word
  }).join(' ')
}

function generateShortName(fullName) {
  let name = fullName
  name = name.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim()
  name = name.replace(/\(.*?\)/g, '').trim()
  name = name.replace(/""[^""]*""/g, '').trim()
  name = name.replace(/^tattoo\s+(by|shop|estudio)\s+/i, '').trim()
  name = name.split(/\s*[·|•]\s*/)[0].trim()
  name = name.split(/\s*[/–—]\s*/)[0].trim()
  name = name.split(/\s+-\s+/)[0].trim()
  name = name.split(',')[0].trim()
  name = name.replace(/\s+y\s+(galería|galeria|eliminación|eliminacion|boutique|arte|piercing|moda).*/i, '').trim()
  name = name.replace(/\s+by\s+.*/i, '').trim()
  name = name.replace(/:\s+.*/i, '').trim()
  name = name.replace(/\b(S\.?L\.?U?\.?|S\.?A\.?)\b/gi, '').trim()
  name = name.replace(/[&,.\-•]+$/, '').trim()
  for (const prefix of GENERIC_PREFIXES) {
    name = name.replace(new RegExp(`^${prefix}\\s+`, 'i'), '').trim()
  }
  let prev = ''
  while (prev !== name) {
    prev = name
    for (const loc of LOCATION_WORDS) {
      name = name.replace(new RegExp(`\\s+${loc}\\s*$`, 'i'), '').trim()
    }
    name = name.replace(/\s+(sur|norte|este|oeste|n[oó]rdico)\s*$/i, '').trim()
    name = name.replace(/\s+n\s+\d+\s*$/i, '').trim()
    name = name.replace(/\b(studio|estudio|parlour|shop|parte)\s+\d+\s*$/i, (m, w) => w).trim()
    for (const suffix of GENERIC_SUFFIXES) {
      const esc = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      name = name.replace(new RegExp(`\\s+${esc}\\s*$`, 'i'), '').trim()
    }
    name = name.replace(/\s+(y|&|and|or|e)\s*$/i, '').trim()
    name = name.replace(/[&,.\-•]+$/, '').trim()
  }
  name = name.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase())
  name = preserveCaps(fullName, name)
  const words = name.trim().split(/\s+/)
  if (words.length > 3) name = words.slice(0, 3).join(' ')
  name = name.replace(/\s+(y|&|and|or|e|de|del|la|las|los|el)\s*$/i, '').trim()
  name = name.replace(/[&,.\-•]+$/, '').trim()
  if (!name || name.length < 2 || STOP_WORDS.has(name.toLowerCase())) {
    name = fullName.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[·|•]/g, ' ').trim()
      .toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase())
      .split(/\s+/).slice(0, 2).join(' ')
  }
  return name
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = []
  let current = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) { result.push(current); current = '' }
    else current += char
  }
  result.push(current)
  return result
}

function escapeCSV(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  return (str.includes(',') || str.includes('"') || str.includes('\n'))
    ? `"${str.replace(/"/g, '""')}"` : str
}

function normalizePhone(p) {
  return (p || '').replace(/[\s\-().]/g, '')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Read existing export — build set of already-exported phones and names
  const existingContent = await fs.readFile(EXISTING_EXPORT, 'utf-8')
  const existingLines = existingContent.split('\n').filter(l => l.trim())
  const existingPhones = new Set()
  const existingNames  = new Set()

  for (let i = 1; i < existingLines.length; i++) {
    const cols = parseCSVLine(existingLines[i])
    const phone = normalizePhone(cols[3])
    const name  = (cols[2] || '').toLowerCase().trim()
    if (phone) existingPhones.add(phone)
    if (name)  existingNames.add(name)
  }
  console.log(`Existing export: ${existingLines.length - 1} contacts`)
  console.log(`  Phones indexed: ${existingPhones.size}`)

  // 2. Query DB for all Canarias tattoo/ink studios
  const { rows } = await pool.query(`
    SELECT
      name,
      phone,
      email,
      city,
      website,
      reviews_count,
      rating,
      permanently_closed
    FROM businesses
    WHERE (name ILIKE '%tattoo%' OR name ILIKE '%ink%' OR category ILIKE '%tattoo%' OR category ILIKE '%ink%')
      AND country_code = 'es'
      AND state = ANY(ARRAY['Las Palmas','Santa Cruz de Tenerife'])
      AND (permanently_closed IS NULL OR permanently_closed = false)
      AND phone IS NOT NULL AND phone != ''
    ORDER BY reviews_count DESC NULLS LAST, name ASC
  `)
  console.log(`\nDB: ${rows.length} active Canarias tattoo/ink studios with phone`)

  // 3. Classify each as new or existing
  const HEADER = 'First Name,Last Name,Company Name,Phone,Email,City,Website,Tags,Reviews Count,Short Name'
  const TAGS   = 'canarias-tattoo,whatsapp-campaign'

  const allRows = []
  const newRows = []

  for (const biz of rows) {
    const phone     = normalizePhone(biz.phone)
    const nameLower = biz.name.toLowerCase().trim()
    const isNew     = !existingPhones.has(phone) && !existingNames.has(nameLower)

    const shortName = generateShortName(biz.name)
    const row = [
      '',                        // First Name
      '',                        // Last Name
      biz.name,                  // Company Name
      biz.phone,                 // Phone
      biz.email || '',           // Email
      biz.city  || '',           // City
      biz.website || '',         // Website
      TAGS,                      // Tags
      biz.reviews_count ?? '',   // Reviews Count
      shortName,                 // Short Name
    ].map(escapeCSV).join(',')

    allRows.push(row)
    if (isNew) newRows.push(row)
  }

  // 4. Write files
  await fs.writeFile(OUT_NEW, [HEADER, ...newRows].join('\n'), 'utf-8')
  await fs.writeFile(OUT_ALL, [HEADER, ...allRows].join('\n'), 'utf-8')

  const alreadyExported = rows.length - newRows.length

  console.log('\n=== Summary ===')
  console.log(`  Total in DB:          ${rows.length}`)
  console.log(`  Already exported:     ${alreadyExported}`)
  console.log(`  NEW contacts:         ${newRows.length}`)
  console.log(`\nFiles written:`)
  console.log(`  NEW only:  ${path.basename(OUT_NEW)}  (${newRows.length} rows)`)
  console.log(`  ALL:       ${path.basename(OUT_ALL)}  (${rows.length} rows, updated review counts)`)

  // 5. Preview new contacts
  if (newRows.length > 0) {
    console.log('\nNew contacts preview (by city):')
    const cityCounts = {}
    for (const biz of rows) {
      const phone = normalizePhone(biz.phone)
      const nameLower = biz.name.toLowerCase().trim()
      const isNew = !existingPhones.has(phone) && !existingNames.has(nameLower)
      if (isNew) cityCounts[biz.city || '(no city)'] = (cityCounts[biz.city || '(no city)'] || 0) + 1
    }
    Object.entries(cityCounts).sort((a,b) => b[1]-a[1]).forEach(([city, count]) => {
      console.log(`  ${city}: ${count}`)
    })
  }

  await pool.end()
}

main().catch(err => { console.error('Error:', err.message); process.exit(1) })
