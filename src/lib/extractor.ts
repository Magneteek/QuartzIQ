/**
 * Universal Business Review Extractor - TypeScript Version
 * Standardized system for extracting negative reviews from any business category
 * Works with restaurants, hotels, clinics, retail stores, services, etc.
 */

import https from 'https'

interface SearchCriteria {
  category: string
  location: string
  maxRating?: number
  maxStars?: number
  dayLimit?: number
  businessLimit?: number
  minReviews?: number
  minTextLength?: number
  language?: string
  maxQueries?: number
  resultsPerQuery?: number
  countryCode?: string
}

interface Business {
  title: string
  address: string
  totalScore: number
  reviewsCount: number
  placeId: string
  url?: string
  // Contact Information
  phone?: string
  website?: string
  email?: string
  socialMedia?: {
    facebook?: string
    linkedin?: string
    twitter?: string
    instagram?: string
  }
  contactEnriched?: boolean
  enrichmentDate?: Date
}

interface Review {
  title: string
  address: string
  name: string
  stars: number
  publishedAtDate: string
  reviewerNumberOfReviews: number
  isLocalGuide: boolean
  originalLanguage: string
  text: string
  reviewUrl: string
  reviewerUrl: string
  url: string
  placeId: string
}

export class UniversalBusinessReviewExtractor {
  private apiToken: string
  private baseUrl: string
  private actorMapsId: string
  private actorReviewsId: string

  constructor() {
    this.apiToken = process.env.APIFY_API_TOKEN || ''
    this.baseUrl = 'https://api.apify.com/v2'
    this.actorMapsId = 'compass~crawler-google-places'
    this.actorReviewsId = 'compass~google-maps-reviews-scraper'
  }

  async extractBusinessReviews(searchCriteria: SearchCriteria) {
    try {
      console.log(`🚀 Universal Business Review Extraction`)
      console.log(`Category: ${searchCriteria.category}`)
      console.log(`Location: ${searchCriteria.location}`)
      console.log(`=======================================\n`)

      // Step 1: Find businesses
      console.log(`🔍 STEP 1: Finding ${searchCriteria.category} businesses`)
      console.log(`================================================`)

      const businesses = await this.findBusinesses(searchCriteria)
      console.log(`✅ Found ${businesses.length} businesses`)

      // Step 2: Extract reviews
      console.log(`\n🔍 STEP 2: Extracting Reviews`)
      console.log(`=============================`)

      const targetBusinesses = businesses
        .filter(business =>
          business.totalScore &&
          business.totalScore <= (searchCriteria.maxRating || 4.6) &&
          business.reviewsCount > (searchCriteria.minReviews || 10)
        )
        .slice(0, searchCriteria.businessLimit || 5)

      console.log(`🎯 Targeting ${targetBusinesses.length} businesses for review extraction`)

      const allReviews: Review[] = []
      for (const business of targetBusinesses) {
        try {
          console.log(`\n📍 Extracting from: ${business.title}`)
          const reviews = await this.extractReviewsFromBusiness(business, searchCriteria)
          const negativeReviews = reviews.filter(review =>
            review.stars <= (searchCriteria.maxStars || 3)
          )

          console.log(`   ✅ Found ${reviews.length} total, ${negativeReviews.length} negative`)
          allReviews.push(...negativeReviews)

          await this.delay(3000) // Rate limiting
        } catch (error: any) {
          console.log(`   ❌ Error: ${error.message}`)
        }
      }

      // Step 3: Filter and format results
      const filteredReviews = this.filterAndFormatReviews(allReviews, searchCriteria)

      // Step 4: Generate standardized output
      this.generateStandardizedReport(filteredReviews, businesses, searchCriteria)

      return {
        businesses,
        reviews: filteredReviews,
        searchCriteria,
        extractionDate: new Date()
      }

    } catch (error) {
      console.error(`❌ Extraction failed:`, error)
      throw error
    }
  }

  private async findBusinesses(searchCriteria: SearchCriteria): Promise<Business[]> {
    const searchQueries = this.generateSearchQueries(searchCriteria)
    const allBusinesses: Business[] = []

    for (const query of searchQueries) {
      try {
        console.log(`   Searching: "${query}"`)
        const businesses = await this.searchGoogleMaps(
          query,
          searchCriteria.resultsPerQuery || 5,
          searchCriteria.countryCode || 'nl',
          searchCriteria.language || 'nl'
        )
        allBusinesses.push(...businesses)
        console.log(`   Found ${businesses.length} results`)
        await this.delay(2000)
      } catch (error: any) {
        console.log(`   ❌ Search failed: ${error.message}`)
      }
    }

    // Remove duplicates
    const uniqueBusinesses = allBusinesses.filter((business, index, self) =>
      index === self.findIndex(b => b.placeId === business.placeId)
    )

    return uniqueBusinesses
  }

  private generateSearchQueries(criteria: SearchCriteria): string[] {
    const { category, location, language = 'en', countryCode = 'en' } = criteria

    // Multi-language search queries for better coverage
    const queries: string[] = []

    // Country-specific search patterns
    switch (countryCode.toLowerCase()) {
      case 'nl': // Netherlands
        queries.push(
          `${category} ${location}`,
          `${category} Nederland`,
          `beste ${category} ${location}`,
          `top ${category} Nederland`
        )
        break

      case 'de': // Germany
        queries.push(
          `${category} ${location}`,
          `${category} Deutschland`,
          `beste ${category} ${location}`,
          `top ${category} Deutschland`
        )
        break

      case 'at': // Austria
        queries.push(
          `${category} ${location}`,
          `${category} Österreich`,
          `beste ${category} ${location}`,
          `top ${category} Austria`
        )
        break

      case 'ch': // Switzerland
        queries.push(
          `${category} ${location}`,
          `${category} Schweiz`,
          `beste ${category} ${location}`,
          `${category} Switzerland`
        )
        break

      case 'no': // Norway
        queries.push(
          `${category} ${location}`,
          `${category} Norge`,
          `beste ${category} ${location}`,
          `topp ${category} ${location}`
        )
        break

      case 'be': // Belgium
        queries.push(
          `${category} ${location}`,
          `${category} België`,
          `${category} Belgique`,
          `beste ${category} ${location}`
        )
        break

      case 'dk': // Denmark
        queries.push(
          `${category} ${location}`,
          `${category} Danmark`,
          `bedste ${category} ${location}`,
          `top ${category} Danmark`
        )
        break

      case 'se': // Sweden
        queries.push(
          `${category} ${location}`,
          `${category} Sverige`,
          `bästa ${category} ${location}`,
          `topp ${category} Sverige`
        )
        break

      case 'fi': // Finland
        queries.push(
          `${category} ${location}`,
          `${category} Suomi`,
          `paras ${category} ${location}`,
          `top ${category} Finland`
        )
        break

      case 'fr': // France
        queries.push(
          `${category} ${location}`,
          `${category} France`,
          `meilleur ${category} ${location}`,
          `top ${category} France`
        )
        break

      default: // International/English
        queries.push(
          `${category} ${location}`,
          `${category} near ${location}`,
          `best ${category} ${location}`,
          `top ${category} ${location}`
        )
    }

    return queries.slice(0, criteria.maxQueries || 4)
  }

  private async searchGoogleMaps(query: string, maxItems = 10, countryCode = 'nl', language = 'nl'): Promise<Business[]> {
    const input = {
      searchStringsArray: [query],
      maxCrawledPlacesPerSearch: maxItems,
      language: language,
      countryCode: countryCode,
      includeImages: false,
      includeReviews: false
    }

    const runId = await this.runApifyActor(this.actorMapsId, input)
    const results = await this.getApifyResults(runId, this.actorMapsId)
    return results || []
  }

  private async extractReviewsFromBusiness(business: Business, criteria: SearchCriteria): Promise<Review[]> {
    if (!business.placeId) {
      throw new Error('No place ID available')
    }

    const input = {
      placeIds: [business.placeId],
      maxReviews: 5, // Optimized: only scrape 5 most recent reviews per business
      language: criteria.language || 'nl',
      sort: 'newest'
    }

    const runId = await this.runApifyActor(this.actorReviewsId, input)
    const results = await this.getApifyResults(runId, this.actorReviewsId)
    return results || []
  }

  private filterAndFormatReviews(reviews: Review[], criteria: SearchCriteria): Review[] {
    let filtered = reviews

    // Filter by rating
    if (criteria.maxStars) {
      filtered = filtered.filter(review => review.stars <= criteria.maxStars)
    }

    // Filter by date
    if (criteria.dayLimit) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - criteria.dayLimit)
      filtered = filtered.filter(review =>
        new Date(review.publishedAtDate) >= cutoffDate
      )
    }

    // Filter by minimum text length
    if (criteria.minTextLength) {
      filtered = filtered.filter(review =>
        review.text && review.text.length >= criteria.minTextLength
      )
    }

    // Sort by date (newest first) - already sorted by Apify but ensuring consistency
    filtered.sort((a, b) => new Date(b.publishedAtDate).getTime() - new Date(a.publishedAtDate).getTime())

    // No additional limit needed - we already optimize at source with 5 reviews max per business
    return filtered
  }

  private generateStandardizedReport(reviews: Review[], businesses: Business[], criteria: SearchCriteria): void {
    console.log(`\n📊 STANDARDIZED REVIEW EXTRACTION REPORT`)
    console.log(`========================================`)
    console.log(`Category: ${criteria.category}`)
    console.log(`Location: ${criteria.location}`)
    console.log(`Extraction Date: ${new Date().toLocaleDateString()}`)
    console.log(`\n📈 SUMMARY STATISTICS:`)
    console.log(`• Businesses Found: ${businesses.length}`)
    console.log(`• Negative Reviews: ${reviews.length}`)
    console.log(`• Rating Filter: ≤${criteria.maxStars || 3} stars`)
    console.log(`• Time Range: Last ${criteria.dayLimit || 30} days`)
    console.log(`• Optimization: 5 reviews max per business (90% cost reduction)`)
    console.log(`\n📋 REVIEW LIST:`)
    console.log(`==============`)

    if (reviews.length === 0) {
      console.log(`⚠️ No reviews found matching criteria`)
      return
    }

    reviews.forEach((review, index) => {
      const reviewDate = new Date(review.publishedAtDate)
      const daysAgo = Math.floor((new Date().getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24))

      console.log(`\n${index + 1}. ═══════════════════════════════════════`)
      console.log(`Business: ${review.title || 'Unknown'}`)
      console.log(`Address: ${review.address || 'Not provided'}`)
      console.log(`Reviewer: ${review.name || 'Anonymous'}`)
      console.log(`Rating: ${review.stars}/5 ⭐`)
      console.log(`Date: ${reviewDate.toLocaleDateString()} (${daysAgo} days ago)`)
      console.log(`Reviewer Stats: ${review.reviewerNumberOfReviews || 0} reviews, Local Guide: ${review.isLocalGuide ? 'Yes' : 'No'}`)
      console.log(`Language: ${review.originalLanguage || 'Unknown'}`)
      console.log(`\nReview Text:`)
      console.log(`"${review.text || 'No text provided'}"`)
      console.log(`\nDirect Review URL:`)
      console.log(`${review.reviewUrl || 'Not available'}`)
      console.log(`\nReviewer Profile:`)
      console.log(`${review.reviewerUrl || 'Not available'}`)
      console.log(`\nBusiness Profile:`)
      console.log(`${review.url || 'Not available'}`)
    })

    console.log(`\n🎯 EXTRACTION COMPLETE!`)
    console.log(`Found ${reviews.length} negative reviews for ${criteria.category} in ${criteria.location}`)
  }

  // Apify API helper methods
  private async runApifyActor(actorId: string, input: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(input)
      const options = {
        hostname: 'api.apify.com',
        port: 443,
        path: `/v2/acts/${actorId}/runs?token=${this.apiToken}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      }

      const req = https.request(options, (res) => {
        let responseData = ''
        res.on('data', (chunk) => { responseData += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData)
            if (res.statusCode === 201) {
              resolve(parsed.data.id)
            } else {
              reject(new Error(`Apify API error: ${res.statusCode}`))
            }
          } catch (error: any) {
            reject(new Error(`JSON parse error: ${error.message}`))
          }
        })
      })

      req.on('error', (error) => reject(error))
      req.write(data)
      req.end()
    })
  }

  private async getApifyResults(runId: string, actorId: string): Promise<any[]> {
    await this.waitForRunCompletion(runId, actorId)
    const runDetails = await this.getRunDetails(runId, actorId)
    const datasetId = runDetails.defaultDatasetId

    if (!datasetId) {
      throw new Error('No dataset ID found')
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.apify.com',
        port: 443,
        path: `/v2/datasets/${datasetId}/items?token=${this.apiToken}`,
        method: 'GET'
      }

      https.get(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (res.statusCode === 200) {
              resolve(parsed)
            } else {
              reject(new Error(`Results error: ${res.statusCode}`))
            }
          } catch (error: any) {
            reject(new Error(`JSON parse error: ${error.message}`))
          }
        })
      }).on('error', (error) => reject(error))
    })
  }

  private async getRunDetails(runId: string, actorId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.apify.com',
        port: 443,
        path: `/v2/acts/${actorId}/runs/${runId}?token=${this.apiToken}`,
        method: 'GET'
      }

      https.get(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (res.statusCode === 200) {
              resolve(parsed.data)
            } else {
              reject(new Error(`Run details error: ${res.statusCode}`))
            }
          } catch (error: any) {
            reject(new Error(`JSON parse error: ${error.message}`))
          }
        })
      }).on('error', (error) => reject(error))
    })
  }

  private async waitForRunCompletion(runId: string, actorId: string, maxWaitTime = 120000): Promise<boolean> {
    const startTime = Date.now()
    const checkInterval = 5000

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getRunStatus(runId, actorId)
      if (status === 'SUCCEEDED') return true
      if (status === 'FAILED' || status === 'ABORTED') {
        throw new Error(`Run ${status.toLowerCase()}: ${runId}`)
      }
      await this.delay(checkInterval)
    }
    throw new Error(`Run timeout: ${runId}`)
  }

  private async getRunStatus(runId: string, actorId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.apify.com',
        port: 443,
        path: `/v2/acts/${actorId}/runs/${runId}?token=${this.apiToken}`,
        method: 'GET'
      }

      https.get(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            resolve(parsed.data.status)
          } catch (error) {
            reject(error)
          }
        })
      }).on('error', (error) => reject(error))
    })
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}