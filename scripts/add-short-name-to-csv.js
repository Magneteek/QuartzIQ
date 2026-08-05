/**
 * Adds a "Short Name" column to the canarias tattoo GHL import CSV.
 * Short Name = first 1-3 meaningful words of the business name, for use in
 * WhatsApp messages: "Hola {{contact.short_name}}!"
 *
 * Usage:
 *   node scripts/add-short-name-to-csv.js          # full output
 *   node scripts/add-short-name-to-csv.js --preview # just print the name mapping
 */

const fs = require('fs').promises
const path = require('path')

const INPUT_CSV = path.join(__dirname, '../exports/canarias-tattoo-ghl-import-with-reviews.csv')
const OUTPUT_CSV = path.join(__dirname, '../exports/canarias-tattoo-ghl-import-final.csv')
const UPDATE_CSV = path.join(__dirname, '../exports/canarias-tattoo-update-short-name.csv')

// Location words to strip from the end of names (Canary Islands context)
const LOCATION_WORDS = [
  'lanzarote', 'tenerife', 'fuerteventura', 'gran canaria', 'la palma', 'la gomera', 'el hierro',
  'las palmas', 'canarias', 'canary islands', 'maspalomas', 'corralejo', 'arrecife',
  'puerto del carmen', 'costa teguise', 'san agustín', 'san agustin', 'san agustìn', 'playa blanca',
  'puerto de la cruz', 'puerto rico', 'los cristianos', 'playa de las americas',
  'la laguna', 'icod', 'mogán', 'mogan', 'ingenio', 'taco', 'fañabé', 'fanabe',
  'parque santiago', 'san eugenio', 'las canteras', 'primero de mayo',
  'caleta', 'beach', 'oasis', 'pueblo', 'puerto',
]

// Generic business-type words to strip from the END.
// IMPORTANT: compound phrases must come BEFORE their component words so the
// inner while loop doesn't strip the shorter word first and leave an orphan.
const GENERIC_SUFFIXES = [
  // Compound "tattoo + X" — longest first
  'tattoo studio', 'tattoo estudio', 'tattoo parlour', 'tattoo shop',
  'tattoo art gallery', 'tattoo art studio', 'tattoo art lab', 'tattoo gallery',
  'tattoo & piercing', 'tattoo y piercing', 'tattoo piercing', 'tattoo barber',
  'tattoo supply', 'tattoo supplies', 'tattoo supplier', 'tattoo artist',
  'tattoo family', 'tattoo',
  // Compound "& X" type — strip "& Art Gallery" etc.
  '& art gallery', '& art studio', '& art lab', '& piercing', '& barber', '& supplies', '& boutique',
  // Compound "art X" — before standalone "gallery"/"studio"
  'art gallery', 'art studio', 'art lab',
  // Standalone generics
  'studio', 'estudio', 'parlour', 'shop', 'galería', 'galeria', 'gallery',
  'salón', 'salon', 'barber shop', 'barber', 'supply', 'supplies', 'supplier',
  'atelier', 'showroom', 'boutique', 'store',
  'piercing', 'ink',
]

// Generic words that can also appear at the START — strip leading ones
const GENERIC_PREFIXES = [
  'estudio de tatuajes',
  'estudio de tatuaje',
]

function titleCase(str) {
  // Preserve all-caps words of 1-4 chars (acronyms: GPS, TM, AR, RTA, INK, GCD, RL, AH)
  return str
    .toLowerCase()
    .replace(/(?:^|\s)\S+/g, word => {
      const raw = word.trim()
      // If original word was all-caps and short, keep it uppercase
      const orig = str.slice(str.toLowerCase().indexOf(raw.toLowerCase()))
      return word.replace(raw, raw.charAt(0).toUpperCase() + raw.slice(1))
    })
}

// Short stop words that are meaningless alone as a short name
const STOP_WORDS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'the', 'a', 'al', 'un', 'una'])

function preserveCaps(original, result) {
  // Build set of 2-4 char all-caps pure-ASCII words from original (GPS, TM, AR, etc.)
  const capsWords = new Set()
  for (const w of original.split(/\s+/)) {
    const ascii = w.replace(/[^A-Za-z]/g, '')
    if (/^[A-Z]{2,4}$/.test(ascii)) capsWords.add(ascii)
  }
  if (capsWords.size === 0) return result
  // Apply whole-word: split result by spaces, check each word
  return result.split(' ').map(word => {
    const ascii = word.replace(/[^A-Za-z]/g, '')
    if (capsWords.has(ascii.toUpperCase())) {
      return word.replace(/[A-Za-z]+/, ascii.toUpperCase())
    }
    return word
  }).join(' ')
}

function generateShortName(fullName) {
  let name = fullName

  // 1. Strip emojis
  name = name.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim()
  // 2. Strip content in parentheses
  name = name.replace(/\(.*?\)/g, '').trim()
  // 3. Strip quoted content like ""MetalizM""
  name = name.replace(/""[^""]*""/g, '').trim()
  // 4. Strip "Tattoo by [Name]" / "Tattoo shop [Name]" at the START → just [Name]
  name = name.replace(/^tattoo\s+(by|shop|estudio)\s+/i, '').trim()
  // 5. Strip content after hard separators (take the first meaningful chunk)
  //    ·  |  /  –  —  •  (but not hyphenated-words, only " - " with spaces)
  name = name.split(/\s*[·|•]\s*/)[0].trim()
  name = name.split(/\s*[/–—]\s*/)[0].trim()
  name = name.split(/\s+-\s+/)[0].trim()
  // Split on comma (e.g. "Studio, City, Region." → take first chunk)
  name = name.split(',')[0].trim()
  // Split on Spanish " y " when it introduces a generic second descriptor
  // (e.g. "Lobo Azul Tattoo y Galería de Arte" → "Lobo Azul Tattoo")
  name = name.replace(/\s+y\s+(galería|galeria|eliminación|eliminacion|boutique|arte|piercing|moda).*/i, '').trim()
  // 6. Strip " by ..." and ": ..."
  name = name.replace(/\s+by\s+.*/i, '').trim()
  name = name.replace(/:\s+.*/i, '').trim()
  // 7. Strip legal suffixes (S.L., S.A., S.L.U., S.L.L.)
  name = name.replace(/\b(S\.?L\.?U?\.?|S\.?A\.?)\b/gi, '').trim()
  // 8. Strip trailing punctuation artifacts
  name = name.replace(/[&,.\-•]+$/, '').trim()

  // 9. Strip leading generic prefixes
  for (const prefix of GENERIC_PREFIXES) {
    const re = new RegExp(`^${prefix}\\s+`, 'i')
    name = name.replace(re, '').trim()
  }

  // 10. Combined multi-pass: strip trailing locations AND generic suffixes together
  //     Interleave until stable so removing "TATTOO" from end exposes "LANZAROTE"
  let prev = ''
  while (prev !== name) {
    prev = name
    // Trailing location words
    for (const loc of LOCATION_WORDS) {
      const re = new RegExp(`\\s+${loc}\\s*$`, 'i')
      name = name.replace(re, '').trim()
    }
    // Trailing direction / address modifiers
    name = name.replace(/\s+(sur|norte|este|oeste|n[oó]rdico)\s*$/i, '').trim()
    // Trailing "n 13" style address number qualifiers (but NOT brand numbers like "The 33", "Area 31")
    name = name.replace(/\s+n\s+\d+\s*$/i, '').trim()
    // Strip trailing standalone numbers ONLY when preceded by a generic word (Studio 2 → Studio, then Studio stripped)
    // Don't strip numbers that are part of the brand like "Area 31", "The 33", "13 papeles"
    name = name.replace(/\b(studio|estudio|parlour|shop|parte)\s+\d+\s*$/i, (m, w) => w).trim()
    // Trailing generic business-type words (longest first to avoid partial matches)
    for (const suffix of GENERIC_SUFFIXES) {
      const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`\\s+${escaped}\\s*$`, 'i')
      name = name.replace(re, '').trim()
    }
    // Trailing Spanish/English connectors left orphaned after stripping
    name = name.replace(/\s+(y|&|and|or|e)\s*$/i, '').trim()
    name = name.replace(/[&,.\-•]+$/, '').trim()
  }

  // 11. Title case
  name = name
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, c => c.toUpperCase())

  // 12. Re-preserve all-caps short words from original (acronyms like GPS, TM, RTA, INK)
  name = preserveCaps(fullName, name)

  // 13. Cap at 3 words
  const words = name.trim().split(/\s+/)
  if (words.length > 3) {
    name = words.slice(0, 3).join(' ')
  }

  // 13b. After capping, strip any trailing connectors/punctuation that got exposed
  name = name.replace(/\s+(y|&|and|or|e|de|del|la|las|los|el)\s*$/i, '').trim()
  name = name.replace(/[&,.\-•]+$/, '').trim()

  // 14. Fallback: if result is empty or just a stop word (El, La, The…), use first 2 words
  if (!name || name.length < 2 || STOP_WORDS.has(name.toLowerCase())) {
    const fallback = fullName
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[·|•]/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, c => c.toUpperCase())
    name = fallback.split(/\s+/).slice(0, 2).join(' ')
  }

  return name
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function escapeCSV(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

async function main() {
  const isPreview = process.argv.includes('--preview')

  const content = await fs.readFile(INPUT_CSV, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  const header = parseCSVLine(lines[0])

  const newHeader = [...header, 'Short Name']
  const outputLines = [newHeader.map(escapeCSV).join(',')]
  const updateLines = ['Phone,Short Name']

  let maxOrigLen = 0, maxShortLen = 0
  const pairs = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    const companyName = cols[2] || ''
    const phone = cols[3] || ''
    const shortName = generateShortName(companyName)

    outputLines.push([...cols, shortName].map(escapeCSV).join(','))
    updateLines.push([phone, shortName].map(escapeCSV).join(','))
    pairs.push({ companyName, shortName })
    maxOrigLen = Math.max(maxOrigLen, companyName.length)
    maxShortLen = Math.max(maxShortLen, shortName.length)
  }

  // Always print preview table
  console.log('\n📋 Name mapping preview:\n')
  console.log(`${'Company Name'.padEnd(60)} → Short Name`)
  console.log('-'.repeat(80))
  for (const { companyName, shortName } of pairs) {
    console.log(`${companyName.padEnd(60)} → ${shortName}`)
  }

  if (isPreview) {
    console.log('\n✅ Preview only — no files written. Run without --preview to generate CSVs.')
    return
  }

  await fs.writeFile(OUTPUT_CSV, outputLines.join('\n'), 'utf-8')
  await fs.writeFile(UPDATE_CSV, updateLines.join('\n'), 'utf-8')

  console.log(`\n✅ Done!`)
  console.log(`   Full CSV (new import): ${OUTPUT_CSV}`)
  console.log(`   Update CSV (phone + short name only): ${UPDATE_CSV}`)
  console.log(`\n💡 To update existing GHL contacts without reimporting:`)
  console.log(`   Import "${path.basename(UPDATE_CSV)}" into GHL — it matches on Phone and only updates Short Name.`)
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
