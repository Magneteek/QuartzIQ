/**
 * Test CSV Import Utility
 * Import the user's test CSV and convert it to the format expected by the dashboard
 */

const fs = require('fs')
const path = require('path')

function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n')
  const headers = lines[0].split(',')
  const data = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',')
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    data.push(row)
  }

  return data
}

function processImportedData(csvData) {
  // Separate businesses and reviews
  const businesses = []
  const reviews = []
  const businessMap = new Map()

  csvData.forEach(row => {
    // Create business entry (only if not already exists)
    if (!businessMap.has(row.title)) {
      const business = {
        title: row.title,
        address: row.address,
        totalScore: parseFloat(row.totalScore) || 0,
        reviewsCount: parseInt(row.reviewsCount) || 0,
        placeId: row.placeId,
        phone: row.phone,
        website: row.website,
        email: row.email,
        contactEnriched: row.contactEnriched === 'true',
        enrichmentDate: row.enrichmentDate ? new Date(row.enrichmentDate) : null,
        url: row.url
      }
      businesses.push(business)
      businessMap.set(row.title, business)
    }

    // Create review entry if review data exists
    if (row.name && row.stars && row.publishedAtDate && row.text) {
      const review = {
        title: row.title,
        address: row.address,
        name: row.name,
        stars: parseInt(row.stars) || 0,
        publishedAtDate: row.publishedAtDate,
        text: row.text,
        reviewerNumberOfReviews: parseInt(row.reviewerNumberOfReviews) || 0,
        isLocalGuide: row.isLocalGuide === 'true',
        originalLanguage: row.originalLanguage,
        reviewUrl: row.reviewUrl,
        reviewerUrl: row.reviewerUrl,
        url: row.url,
        placeId: row.placeId
      }
      reviews.push(review)
    }
  })

  return {
    businesses,
    reviews,
    searchCriteria: {
      category: 'doctors',
      location: 'Netherlands',
      maxRating: 4.6,
      maxStars: 3,
      countryCode: 'nl'
    },
    extractionDate: new Date()
  }
}

async function importTestData() {
  console.log('🔄 Importing test CSV data...')

  try {
    const csvPath = path.join(__dirname, 'Business Reviews Sept 21 2025.csv')
    const csvContent = fs.readFileSync(csvPath, 'utf-8')

    const csvData = parseCSV(csvContent)
    console.log(`📊 Parsed ${csvData.length} rows from CSV`)

    const processedData = processImportedData(csvData)
    console.log(`✅ Processed: ${processedData.businesses.length} businesses, ${processedData.reviews.length} reviews`)

    // Save to extraction history for testing
    const historyDir = path.join(__dirname, 'data', 'extraction-history')
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true })
    }

    const id = `extraction_imported_${Date.now()}_test`
    const historyItem = {
      id,
      timestamp: new Date(),
      searchCriteria: processedData.searchCriteria,
      results: {
        businesses: processedData.businesses,
        reviews: processedData.reviews,
        extractionDate: processedData.extractionDate
      },
      statistics: {
        businessesFound: processedData.businesses.length,
        reviewsFound: processedData.reviews.length,
        avgRating: processedData.reviews.length > 0
          ? processedData.reviews.reduce((sum, review) => sum + review.stars, 0) / processedData.reviews.length
          : 0,
        extractionTime: 0
      }
    }

    const dataFile = path.join(historyDir, `${id}.json`)
    fs.writeFileSync(dataFile, JSON.stringify(historyItem, null, 2))

    console.log(`💾 Saved test data to: ${dataFile}`)
    console.log(`🎯 Data structure:`)
    console.log(`   - Businesses: ${processedData.businesses.length}`)
    console.log(`   - Reviews: ${processedData.reviews.length}`)
    console.log(`   - Sample business fields: ${Object.keys(processedData.businesses[0] || {}).join(', ')}`)
    console.log(`   - Sample review fields: ${Object.keys(processedData.reviews[0] || {}).join(', ')}`)

  } catch (error) {
    console.error('❌ Import failed:', error.message)
  }
}

// Run the import
importTestData()