/**
 * Adds reviews_count from the database to the canarias tattoo GHL import CSV.
 * Matches by phone number (primary), falls back to company name.
 * Usage: node scripts/add-reviews-count-to-csv.js
 */

const fs = require('fs').promises
const path = require('path')
const { Pool } = require('pg')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const INPUT_CSV = path.join(__dirname, '../exports/canarias-tattoo-ghl-import.csv')
const OUTPUT_CSV = path.join(__dirname, '../exports/canarias-tattoo-ghl-import-with-reviews.csv')

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

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
  console.log('📂 Reading CSV...')
  const content = await fs.readFile(INPUT_CSV, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())

  const header = parseCSVLine(lines[0])
  console.log(`📊 Found ${lines.length - 1} studios`)
  console.log(`📋 Current columns: ${header.join(', ')}`)

  // Load all tattoo businesses from DB into maps
  console.log('\n🔍 Loading businesses from database...')
  const { rows } = await pool.query(`
    SELECT name, phone, reviews_count
    FROM businesses
  `)
  console.log(`✅ Loaded ${rows.length} businesses from DB`)

  // Build lookup maps
  const byPhone = new Map()
  const byName = new Map()
  for (const row of rows) {
    if (row.phone) {
      // Normalize phone: remove spaces and special chars except +
      const normalizedPhone = row.phone.replace(/[\s\-().]/g, '')
      byPhone.set(normalizedPhone, row)
    }
    if (row.name) {
      byName.set(row.name.toLowerCase().trim(), row)
    }
  }

  // Process each CSV row
  let matched = 0
  let notFound = 0

  const newHeader = [...header, 'Reviews Count']
  const outputLines = [newHeader.map(escapeCSV).join(',')]

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    // CSV: First Name, Last Name, Company Name, Phone, Email, City, Website, Tags...
    const companyName = cols[2] || ''
    const phone = cols[3] || ''

    let reviewsCount = ''
    let matchedBy = ''

    // Try phone match first
    const normalizedPhone = phone.replace(/[\s\-().]/g, '')
    if (normalizedPhone && byPhone.has(normalizedPhone)) {
      const biz = byPhone.get(normalizedPhone)
      reviewsCount = biz.reviews_count ?? ''
      matchedBy = 'phone'
      matched++
    } else {
      // Try name match
      const nameLower = companyName.toLowerCase().trim()
      if (nameLower && byName.has(nameLower)) {
        const biz = byName.get(nameLower)
        reviewsCount = biz.reviews_count ?? ''
        matchedBy = 'name'
        matched++
      } else {
        notFound++
        console.log(`  ⚠️  No match: "${companyName}" (${phone})`)
      }
    }

    outputLines.push([...cols, reviewsCount].map(escapeCSV).join(','))
  }

  await fs.writeFile(OUTPUT_CSV, outputLines.join('\n'), 'utf-8')

  console.log(`\n✅ Done!`)
  console.log(`   Matched: ${matched}/${lines.length - 1}`)
  console.log(`   Not found: ${notFound}`)
  console.log(`   Output: ${OUTPUT_CSV}`)

  await pool.end()
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
