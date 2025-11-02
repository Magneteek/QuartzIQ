/**
 * Test Export Function with Mock Review Data
 * Create sample data structure and test the export function
 */

const testData = {
  businesses: [
    {
      title: "Central Doctors",
      address: "De Ruijterkade 24a, 1012 AA Amsterdam, Nederland",
      totalScore: 2.4,
      reviewsCount: 341,
      placeId: "ChIJx63H4rYJxkcR9OTyjRKZCGc",
      phone: "+31 20 235 7823",
      website: "http://www.centraldoctors.nl/",
      email: "info@centraldoctors.nl",
      contactEnriched: true,
      enrichmentDate: "2025-09-21T17:38:22.964Z",
      url: "https://www.google.com/maps/search/?api=1&query=Central%20Doctors"
    },
    {
      title: "Expat Medical Centre Amsterdam",
      address: "Bloemgracht 112, 1015 TN Amsterdam, Nederland",
      totalScore: 2.2,
      reviewsCount: 190,
      placeId: "ChIJNx9cD9sJxkcRWxIeY6GKoro",
      phone: "+31 20 427 5011",
      website: "https://www.expatmc.net/",
      email: "",
      contactEnriched: true,
      enrichmentDate: "2025-09-21T17:38:33.640Z",
      url: "https://www.google.com/maps/search/?api=1&query=Expat%20Medical%20Centre%20Amsterdam"
    }
  ],
  reviews: [
    {
      title: "Central Doctors",
      address: "De Ruijterkade 24a, 1012 AA Amsterdam, Nederland",
      name: "Sarah Johnson",
      stars: 2,
      publishedAtDate: "2025-09-15T14:30:00.000Z",
      text: "Long waiting times and staff seemed rushed. The doctor was professional but the overall experience was disappointing.",
      reviewerNumberOfReviews: 25,
      isLocalGuide: false,
      originalLanguage: "en",
      reviewUrl: "https://www.google.com/maps/reviews/@52.3738,4.9134,17z/data=review1",
      reviewerUrl: "https://www.google.com/maps/contrib/reviewer1",
      url: "https://www.google.com/maps/search/?api=1&query=Central%20Doctors",
      placeId: "ChIJx63H4rYJxkcR9OTyjRKZCGc"
    },
    {
      title: "Central Doctors",
      address: "De Ruijterkade 24a, 1012 AA Amsterdam, Nederland",
      name: "Marco van Berg",
      stars: 3,
      publishedAtDate: "2025-09-18T10:15:00.000Z",
      text: "Redelijke service, maar de wachttijd was te lang. Locatie is wel handig in het centrum.",
      reviewerNumberOfReviews: 12,
      isLocalGuide: true,
      originalLanguage: "nl",
      reviewUrl: "https://www.google.com/maps/reviews/@52.3738,4.9134,17z/data=review2",
      reviewerUrl: "https://www.google.com/maps/contrib/reviewer2",
      url: "https://www.google.com/maps/search/?api=1&query=Central%20Doctors",
      placeId: "ChIJx63H4rYJxkcR9OTyjRKZCGc"
    },
    {
      title: "Expat Medical Centre Amsterdam",
      address: "Bloemgracht 112, 1015 TN Amsterdam, Nederland",
      name: "Emma Thompson",
      stars: 1,
      publishedAtDate: "2025-09-20T16:45:00.000Z",
      text: "Terrible experience. Very expensive and the staff was unfriendly. Would not recommend to anyone.",
      reviewerNumberOfReviews: 8,
      isLocalGuide: false,
      originalLanguage: "en",
      reviewUrl: "https://www.google.com/maps/reviews/@52.3738,4.9134,17z/data=review3",
      reviewerUrl: "https://www.google.com/maps/contrib/reviewer3",
      url: "https://www.google.com/maps/search/?api=1&query=Expat%20Medical%20Centre%20Amsterdam",
      placeId: "ChIJNx9cD9sJxkcRWxIeY6GKoro"
    }
  ],
  searchCriteria: {
    category: "doctors",
    location: "Amsterdam, Netherlands",
    maxRating: 4.6,
    maxStars: 3,
    countryCode: "nl"
  },
  extractionDate: new Date()
}

async function testExportFunction() {
  console.log('🧪 Testing Export Function with Mock Review Data')
  console.log(`📊 Test data: ${testData.businesses.length} businesses, ${testData.reviews.length} reviews`)

  try {
    const response = await fetch('http://localhost:3069/api/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format: 'csv',
        fields: [
          'title', 'address', 'phone', 'website', 'email', 'contactEnriched',
          'name', 'stars', 'publishedAtDate', 'text', 'reviewerNumberOfReviews', 'isLocalGuide'
        ],
        data: testData
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`Export failed: ${response.status} - ${errorData}`)
    }

    const csvContent = await response.text()
    console.log('✅ Export successful!')
    console.log('📄 Generated CSV:')
    console.log('─'.repeat(80))
    console.log(csvContent)
    console.log('─'.repeat(80))

    // Verify the data
    const lines = csvContent.trim().split('\n')
    console.log(`🔍 Verification:`)
    console.log(`   - Header row: ${lines[0]}`)
    console.log(`   - Data rows: ${lines.length - 1}`)
    console.log(`   - Expected reviews: ${testData.reviews.length}`)

    if (lines.length - 1 === testData.reviews.length) {
      console.log('✅ Review count matches!')
    } else {
      console.log(`❌ Review count mismatch! Expected ${testData.reviews.length}, got ${lines.length - 1}`)
    }

    // Check if review data is present
    const secondLine = lines[1]?.split(',')
    if (secondLine && secondLine.length >= 6) {
      console.log(`🔍 Sample review data in row 2:`)
      console.log(`   - Business: ${secondLine[0]}`)
      console.log(`   - Reviewer: ${secondLine[6]}`)
      console.log(`   - Stars: ${secondLine[7]}`)
      console.log(`   - Has text: ${secondLine[9]?.length > 0 ? 'Yes' : 'No'}`)
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testExportFunction()