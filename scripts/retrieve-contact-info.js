/**
 * Contact Information Retrieval Utility
 * Extract contact info from previous extraction runs and merge with CSV businesses
 */

const fs = require('fs')
const path = require('path')

// Function to parse CSV
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n')
  const headers = lines[0].split(',')
  const data = []

  for (let i = 1; i < lines.length; i++) {
    // Handle CSV parsing with quoted fields
    const row = {}
    const line = lines[i]
    const values = []
    let current = ''
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current)
        current = ''
      } else {
        current += char
      }
    }
    values.push(current) // Add the last value

    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].replace(/"/g, '') : ''
    })
    data.push(row)
  }

  return data
}

// Function to get all contact info from extraction history
function getAllContactInfo() {
  const historyDir = path.join(__dirname, 'data', 'extraction-history')
  const contactMap = new Map()

  try {
    const files = fs.readdirSync(historyDir).filter(file => file.endsWith('.json') && file !== 'index.json')

    console.log(`📁 Found ${files.length} extraction files`)

    for (const file of files) {
      try {
        const filePath = path.join(historyDir, file)
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

        if (data.results && data.results.businesses) {
          data.results.businesses.forEach(business => {
            if (business.contactEnriched && (business.phone || business.email || business.website)) {
              const key = business.title.toLowerCase().trim()

              // Keep the most recent enriched data
              if (!contactMap.has(key) ||
                  (business.enrichmentDate && new Date(business.enrichmentDate) > new Date(contactMap.get(key).enrichmentDate || 0))) {
                contactMap.set(key, {
                  title: business.title,
                  phone: business.phone || '',
                  email: business.email || '',
                  website: business.website || '',
                  contactEnriched: business.contactEnriched,
                  enrichmentDate: business.enrichmentDate,
                  source: file
                })
              }
            }
          })
        }
      } catch (error) {
        console.warn(`⚠️ Could not process ${file}:`, error.message)
      }
    }

    console.log(`✅ Extracted contact info for ${contactMap.size} businesses`)
    return contactMap
  } catch (error) {
    console.error('❌ Error reading extraction history:', error.message)
    return new Map()
  }
}

// Function to merge contact info with CSV data
function mergeContactInfo() {
  console.log('🔄 Retrieving contact information from previous extraction runs...')

  try {
    // Read the CSV file
    const csvPath = path.join(__dirname, 'Business Reviews Sept 21 2025.csv')
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const csvData = parseCSV(csvContent)

    console.log(`📊 Loaded ${csvData.length} businesses from CSV`)

    // Get contact info from extraction history
    const contactMap = getAllContactInfo()

    // Merge contact information
    let enrichedCount = 0
    let newPhoneCount = 0
    let newEmailCount = 0
    let newWebsiteCount = 0

    const enrichedData = csvData.map(row => {
      const businessKey = row.title.toLowerCase().trim()
      const contactInfo = contactMap.get(businessKey)

      if (contactInfo) {
        enrichedCount++

        // Update with enriched contact info if missing or if we have newer data
        const result = { ...row }

        if (!result.phone && contactInfo.phone) {
          result.phone = contactInfo.phone
          newPhoneCount++
        }
        if (!result.email && contactInfo.email) {
          result.email = contactInfo.email
          newEmailCount++
        }
        if (!result.website && contactInfo.website) {
          result.website = contactInfo.website
          newWebsiteCount++
        }

        result.contactEnriched = 'true'
        result.enrichmentDate = contactInfo.enrichmentDate || new Date().toISOString()

        console.log(`✅ ${result.title}: Phone: ${result.phone ? '✓' : '✗'}, Email: ${result.email ? '✓' : '✗'}, Website: ${result.website ? '✓' : '✗'}`)

        return result
      } else {
        console.log(`❌ ${row.title}: No contact info found in extraction history`)
        return row
      }
    })

    // Generate updated CSV
    const headers = Object.keys(enrichedData[0])
    const csvLines = [headers.join(',')]

    enrichedData.forEach(row => {
      const values = headers.map(header => {
        const value = row[header] || ''
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\\n'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      })
      csvLines.push(values.join(','))
    })

    const enrichedCsvContent = csvLines.join('\\n')
    const outputPath = path.join(__dirname, 'Business Reviews Sept 21 2025 - ENRICHED.csv')
    fs.writeFileSync(outputPath, enrichedCsvContent)

    console.log('\\n📊 CONTACT ENRICHMENT SUMMARY:')
    console.log('================================')
    console.log(`Total businesses: ${csvData.length}`)
    console.log(`Businesses enriched: ${enrichedCount}`)
    console.log(`New phone numbers added: ${newPhoneCount}`)
    console.log(`New email addresses added: ${newEmailCount}`)
    console.log(`New websites added: ${newWebsiteCount}`)
    console.log(`\\n💾 Enriched data saved to: ${outputPath}`)

    // Show enriched contact summary
    const totalContacts = enrichedData.filter(row => row.phone || row.email || row.website).length
    const totalPhones = enrichedData.filter(row => row.phone).length
    const totalEmails = enrichedData.filter(row => row.email).length
    const totalWebsites = enrichedData.filter(row => row.website).length

    console.log('\\n📞 FINAL CONTACT STATISTICS:')
    console.log('============================')
    console.log(`Businesses with any contact info: ${totalContacts}/${csvData.length} (${Math.round(totalContacts/csvData.length*100)}%)`)
    console.log(`Businesses with phone: ${totalPhones}/${csvData.length} (${Math.round(totalPhones/csvData.length*100)}%)`)
    console.log(`Businesses with email: ${totalEmails}/${csvData.length} (${Math.round(totalEmails/csvData.length*100)}%)`)
    console.log(`Businesses with website: ${totalWebsites}/${csvData.length} (${Math.round(totalWebsites/csvData.length*100)}%)`)

  } catch (error) {
    console.error('❌ Contact enrichment failed:', error.message)
  }
}

// Run the contact enrichment
mergeContactInfo()