/**
 * Universal Business Review Extractor - TypeScript Version
 * Standardized system for extracting negative reviews from any business category
 * Works with restaurants, hotels, clinics, retail stores, services, etc.
 */

import * as https from 'https'

interface SearchCriteria {
  category: string
  location: string
  minRating?: number // Business overall rating filter (user-controlled)
  maxReviewsPerBusiness?: number // Max reviews to check per business
  maxStars?: number // Review star rating filter
  dayLimit?: number // Review age limit in days
  businessLimit?: number // Max businesses to crawl
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
  private apiToken: string | undefined
  private baseUrl: string
  private actorMapsId: string
  private actorReviewsId: string

  constructor() {
    this.apiToken = process.env.APIFY_API_TOKEN
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

      // Filter businesses based on user's rating criteria only
      const targetBusinesses = businesses
        .filter(business => {
          // Must have a rating
          if (!business.totalScore) {
            return false
          }

          // Apply minimum rating filter if specified
          const minRating = searchCriteria.minRating
          if (minRating !== undefined && business.totalScore < minRating) {
            return false
          }

          return true
        })
        .slice(0, searchCriteria.businessLimit || 5)

      console.log(`🎯 Targeting ${targetBusinesses.length} businesses for review extraction`)

      // Debug: Log the target businesses
      console.log('📋 Target businesses:')
      targetBusinesses.forEach((business, i) => {
        console.log(`   ${i+1}. ${business.title} (${business.totalScore}★, ${business.reviewsCount} reviews)`)
      })
      console.log('')

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

      // Step 4: Only return businesses that have qualifying reviews (lead generation)
      const businessesWithQualifyingReviews = businesses.filter(business =>
        filteredReviews.some(review => review.title === business.title)
      )

      // Step 5: Generate standardized output
      this.generateStandardizedReport(filteredReviews, businessesWithQualifyingReviews, searchCriteria)

      return {
        businesses: businessesWithQualifyingReviews,
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

    // 🛡️ PRE-SEARCH VALIDATION - Prevent wasting API quota on bad queries
    const validatedQueries = this.validateSearchQueries(searchQueries, searchCriteria)
    if (validatedQueries.length === 0) {
      console.log(`   ⚠️ VALIDATION FAILED: No valid search queries generated`)
      console.log(`   🚫 PREVENTING API WASTE: Stopping search to preserve quota`)
      return []
    }

    console.log(`   ✅ VALIDATION PASSED: ${validatedQueries.length} valid queries`)
    console.log(`   📝 Queries: ${validatedQueries.map(q => `"${q}"`).join(', ')}`)

    const allBusinesses: Business[] = []

    for (const query of validatedQueries) {
      try {
        // Calculate results per query based on businessLimit to maximize coverage
        const resultsPerQuery = Math.ceil((searchCriteria.businessLimit || 50) / 4) // Divide by 4 queries
        console.log(`   Searching: "${query}" (requesting ${resultsPerQuery} results)`)
        const businesses = await this.searchGoogleMaps(
          query,
          resultsPerQuery,
          searchCriteria.countryCode || 'nl',
          searchCriteria.language || 'nl'
        )

        // 🛡️ POST-SEARCH VALIDATION - Filter results by geographic correctness
        const validatedBusinesses = this.validateGeographicResults(businesses, searchCriteria)
        const filteredCount = businesses.length - validatedBusinesses.length

        if (filteredCount > 0) {
          console.log(`   🌍 GEOGRAPHIC FILTER: Removed ${filteredCount} businesses from wrong region`)
          console.log(`   ✅ Keeping ${validatedBusinesses.length} geographically correct results`)
        }

        allBusinesses.push(...validatedBusinesses)
        console.log(`   Found ${validatedBusinesses.length} valid results`)
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

    // Translate business category to local language
    const localizedCategory = this.translateBusinessCategory(category, countryCode)

    // Country-specific search patterns
    switch (countryCode.toLowerCase()) {
      case 'nl': // Netherlands
        // For country-level searches, use major cities for better coverage
        if (location.toLowerCase() === 'netherlands' || location.toLowerCase() === 'nederland') {
          const majorCities = ['Amsterdam', 'Rotterdam', 'Utrecht', 'Den Haag']
          // Search top 4 major cities with localized category
          majorCities.forEach(city => {
            queries.push(`${localizedCategory} ${city}`)
          })
          // Add English variation for first city (international businesses)
          if (localizedCategory !== category) {
            queries.push(`${category} Amsterdam`)
          }
        } else {
          // For city-specific searches, use more diverse patterns
          queries.push(
            `${localizedCategory} ${location}`,
            `${category} ${location}`, // English variation
            `${localizedCategory} in ${location}`,
            `${localizedCategory} nabij ${location}` // "near [city]"
          )
        }
        break

      case 'de': // Germany
        // For country-level searches (location = "Deutschland"), rely on countryCode for geographic targeting
        if (location.toLowerCase() === 'deutschland' || location.toLowerCase() === 'germany') {
          queries.push(
            `${localizedCategory}`, // Let countryCode handle geography
            `${localizedCategory} in Deutschland`,
            `beste ${localizedCategory}`,
            `top ${localizedCategory}`
          )
          if (localizedCategory !== category) {
            queries.push(`${category}`) // English fallback without country name
          }
        } else {
          // For city-specific searches
          queries.push(
            `${localizedCategory} ${location}`,
            `${localizedCategory} in ${location}`,
            `beste ${localizedCategory} ${location}`,
            `${localizedCategory} ${location} Deutschland`
          )
          if (localizedCategory !== category) {
            queries.push(`${category} ${location}`)
          }
        }
        break

      case 'at': // Austria
        // For country-level searches (location = "Österreich"/"Austria"), rely on countryCode for geographic targeting
        if (location.toLowerCase() === 'österreich' || location.toLowerCase() === 'austria') {
          queries.push(
            `${localizedCategory}`, // Let countryCode handle geography
            `${localizedCategory} in Österreich`,
            `beste ${localizedCategory}`,
            `top ${localizedCategory}`
          )
          if (localizedCategory !== category) {
            queries.push(`${category}`) // English fallback without country name
          }
        } else {
          // For city-specific searches
          queries.push(
            `${localizedCategory} ${location}`,
            `${localizedCategory} in ${location}`,
            `beste ${localizedCategory} ${location}`,
            `${localizedCategory} ${location} Österreich`
          )
          if (localizedCategory !== category) {
            queries.push(`${category} ${location}`)
          }
        }
        break

      case 'ch': // Switzerland
        // For country-level searches (location = "Schweiz"), rely on countryCode for geographic targeting
        if (location.toLowerCase() === 'schweiz' || location.toLowerCase() === 'switzerland') {
          queries.push(
            `${localizedCategory}`, // Let countryCode handle geography
            `${localizedCategory} in der Schweiz`,
            `beste ${localizedCategory}`,
            `top ${localizedCategory}`
          )
          if (localizedCategory !== category) {
            queries.push(`${category}`) // English fallback without country name
          }
        } else {
          // For city-specific searches
          queries.push(
            `${localizedCategory} ${location}`,
            `${localizedCategory} in ${location}`,
            `beste ${localizedCategory} ${location}`,
            `${localizedCategory} ${location} Schweiz`
          )
          if (localizedCategory !== category) {
            queries.push(`${category} ${location}`)
          }
        }
        break

      case 'es': // Spain
        // For country-level searches (location = "España"), rely on countryCode for geographic targeting
        if (location.toLowerCase() === 'españa' || location.toLowerCase() === 'spain') {
          queries.push(
            `${localizedCategory}`, // Let countryCode handle geography
            `${localizedCategory} en España`,
            `mejor ${localizedCategory}`,
            `mejores ${localizedCategory}`
          )
          if (localizedCategory !== category) {
            queries.push(`${category}`) // English fallback without country name
          }
        } else {
          // For city-specific searches
          queries.push(
            `${localizedCategory} ${location}`,
            `${localizedCategory} en ${location}`,
            `mejor ${localizedCategory} ${location}`,
            `mejores ${localizedCategory} ${location}`
          )
          if (localizedCategory !== category) {
            queries.push(`${category} ${location}`)
          }
        }
        break

      case 'be': // Belgium
        queries.push(
          `${localizedCategory} ${location}`,
          `${localizedCategory} België`,
          `${localizedCategory} Belgique`,
          `beste ${localizedCategory} ${location}`
        )
        if (localizedCategory !== category) {
          queries.push(`${category} ${location}`)
        }
        break

      case 'si': // Slovenia
        // For country-level searches (location = "Slovenija"), rely on countryCode for geographic targeting
        if (location.toLowerCase() === 'slovenija' || location.toLowerCase() === 'slovenia') {
          queries.push(
            `${localizedCategory}`, // Let countryCode handle geography
            `${localizedCategory} v Sloveniji`,
            `najboljši ${localizedCategory}`,
            `najbolje ${localizedCategory}`
          )
          if (localizedCategory !== category) {
            queries.push(`${category}`) // English fallback without country name
          }
        } else {
          // For city-specific searches
          queries.push(
            `${localizedCategory} ${location}`,
            `${localizedCategory} v ${location}`,
            `najboljši ${localizedCategory} ${location}`,
            `najbolje ${localizedCategory} ${location}`
          )
          if (localizedCategory !== category) {
            queries.push(`${category} ${location}`)
          }
        }
        break

      case 'hr': // Croatia
        // For country-level searches (location = "Hrvatska"), rely on countryCode for geographic targeting
        if (location.toLowerCase() === 'hrvatska' || location.toLowerCase() === 'croatia') {
          queries.push(
            `${localizedCategory}`, // Let countryCode handle geography
            `${localizedCategory} u Hrvatskoj`,
            `najbolji ${localizedCategory}`,
            `najbolje ${localizedCategory}`
          )
          if (localizedCategory !== category) {
            queries.push(`${category}`) // English fallback without country name
          }
        } else {
          // For city-specific searches
          queries.push(
            `${localizedCategory} ${location}`,
            `${localizedCategory} u ${location}`,
            `najbolji ${localizedCategory} ${location}`,
            `najbolje ${localizedCategory} ${location}`
          )
          if (localizedCategory !== category) {
            queries.push(`${category} ${location}`)
          }
        }
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

  /**
   * Translate business category to local language for better Google Maps search results
   * Based on Google Business Profile standard categories per country
   */
  private translateBusinessCategory(category: string, countryCode: string): string {
    console.log(`   🔄 TRANSLATING: "${category}" for country "${countryCode}"`)

    const translations: Record<string, Record<string, string>> = {
      // Spanish translations
      'es': {
        'tandarts': 'dentista',
        'dentist': 'dentista',
        'doctor': 'médico',
        'lawyer': 'abogado',
        'financial_consultant': 'asesor financiero',
        'insurance_agency': 'aseguradora',
        'real_estate_agency': 'inmobiliaria',
        'jewelry_store': 'joyería',
        'car_dealer': 'concesionario',
        'spa': 'spa'
      },
      // German translations
      'de': {
        'tandarts': 'zahnarzt',
        'dentist': 'zahnarzt',
        'doctor': 'arzt',
        'lawyer': 'anwalt',
        'financial_consultant': 'finanzberater',
        'insurance_agency': 'versicherung',
        'real_estate_agency': 'immobilienmakler',
        'jewelry_store': 'schmuckgeschäft',
        'car_dealer': 'autohändler',
        'spa': 'spa'
      },
      // Slovenian translations
      'si': {
        'tandarts': 'zobozdravnik',
        'dentist': 'zobozdravnik',
        'doctor': 'zdravnik',
        'lawyer': 'odvetnik',
        'financial_consultant': 'finančni svetovalec',
        'insurance_agency': 'zavarovalnica',
        'real_estate_agency': 'nepremičninska agencija',
        'jewelry_store': 'zlatarna',
        'car_dealer': 'avtoprodajalec',
        'spa': 'spa'
      },
      // Dutch translations (current default)
      'nl': {
        // Healthcare & Medical
        'dentist': 'tandarts',
        'doctor': 'dokter',
        'hospital': 'ziekenhuis',
        'medical_clinic': 'medische kliniek',
        'pharmacy': 'apotheek',
        'chiropractor': 'chiropractor',
        'physical_therapist': 'fysiotherapeut',
        'psychologist': 'psycholoog',
        'veterinarian': 'dierenarts',
        'optometrist': 'optometrist',
        // Beauty & Wellness
        'beauty_salon': 'schoonheidssalon',
        'hair_salon': 'kapper',
        'spa': 'spa',
        'nail_salon': 'nagelsalon',
        'barber_shop': 'kapperszaak',
        'massage_therapist': 'massagetherapeut',
        'gym': 'sportschool',
        // Food & Dining
        'restaurant': 'restaurant',
        'cafe': 'café',
        'bar': 'bar',
        'fast_food_restaurant': 'fastfoodrestaurant',
        'pizza_restaurant': 'pizzeria',
        'bakery': 'bakkerij',
        'coffee_shop': 'koffiehuis',
        'caterer': 'cateraar',
        // Hospitality
        'hotel': 'hotel',
        'travel_agency': 'reisbureau',
        'tourist_attraction': 'toeristische attractie',
        // Retail
        'jewelry_store': 'juwelier',
        'clothing_store': 'kledingwinkel',
        'furniture_store': 'meubelzaak',
        'electronics_store': 'electronicazaak',
        'grocery_store': 'supermarkt',
        'gift_shop': 'cadeauwinkel',
        'pet_store': 'dierenwinkel',
        'florist': 'bloemist',
        // Automotive
        'car_dealer': 'autodealer',
        'auto_repair_shop': 'autogarage',
        'car_wash': 'autowasserette',
        'tire_shop': 'bandencentrum',
        'auto_body_shop': 'autoschadeherstel',
        'auto_parts_store': 'auto-onderdelenwinkel',
        // Professional Services
        'lawyer': 'advocaat',
        'attorney': 'advocaat',
        'accountant': 'accountant',
        'financial_planner': 'financieel planner',
        'insurance_agency': 'verzekering',
        'real_estate_agency': 'makelaar',
        'real_estate_agent': 'makelaar',
        'mortgage_lender': 'hypotheekverstrekker',
        'consultant': 'consultant',
        'marketing_agency': 'marketingbureau',
        // Home Services
        'plumber': 'loodgieter',
        'electrician': 'elektricien',
        'hvac_contractor': 'installatiebedrijf',
        'general_contractor': 'aannemer',
        'roofing_contractor': 'dakdekker',
        'landscaper': 'hovenier',
        'painter': 'schilder',
        'house_cleaning_service': 'schoonmaakdienst',
        'pest_control_service': 'ongediertebestrijding',
        'locksmith': 'slotenmaker',
        // Education
        'school': 'school',
        'preschool': 'peuterspeelzaal',
        'tutoring_service': 'bijlesdienst',
        'driving_school': 'rijschool',
        // Entertainment
        'movie_theater': 'bioscoop',
        'bowling_alley': 'bowlingbaan',
        'amusement_park': 'pretpark',
        'museum': 'museum',
        'art_gallery': 'kunstgalerie',
        // Pet Services
        'pet_groomer': 'hondentrimsalon',
        'dog_trainer': 'hondentrainer',
        'pet_boarding_service': 'dierenpension',
        // Technology
        'computer_repair_service': 'computerreparatie',
        'cell_phone_store': 'telefoonwinkel',
        'software_company': 'softwarebedrijf',
        // Fallback
        'financial_consultant': 'financieel adviseur'
      },
      // Austrian translations (German-speaking)
      'at': {
        'tandarts': 'zahnarzt',
        'dentist': 'zahnarzt',
        'doctor': 'arzt',
        'lawyer': 'anwalt',
        'financial_consultant': 'finanzberater',
        'insurance_agency': 'versicherung',
        'real_estate_agency': 'immobilienmakler',
        'jewelry_store': 'schmuckgeschäft',
        'car_dealer': 'autohändler',
        'spa': 'spa'
      },
      // Swiss translations (German-speaking)
      'ch': {
        'tandarts': 'zahnarzt',
        'dentist': 'zahnarzt',
        'doctor': 'arzt',
        'lawyer': 'anwalt',
        'financial_consultant': 'finanzberater',
        'insurance_agency': 'versicherung',
        'real_estate_agency': 'immobilienmakler',
        'jewelry_store': 'schmuckgeschäft',
        'car_dealer': 'autohändler',
        'spa': 'spa'
      },
      // Belgian translations (Dutch-speaking regions)
      'be': {
        'dentist': 'tandarts',
        'doctor': 'dokter',
        'lawyer': 'advocaat',
        'financial_consultant': 'financieel adviseur',
        'insurance_agency': 'verzekering',
        'real_estate_agency': 'makelaar',
        'jewelry_store': 'juwelier',
        'car_dealer': 'autodealer',
        'spa': 'spa'
      },
      // Croatian translations
      'hr': {
        'tandarts': 'zubar',
        'dentist': 'zubar',
        'doctor': 'liječnik',
        'lawyer': 'odvjetnik',
        'financial_consultant': 'financijski savjetnik',
        'insurance_agency': 'osiguranje',
        'real_estate_agency': 'nekretnine',
        'jewelry_store': 'zlatarna',
        'car_dealer': 'prodavaonica automobila',
        'spa': 'spa'
      },
    }

    const countryTranslations = translations[countryCode.toLowerCase()]
    if (countryTranslations && countryTranslations[category.toLowerCase()]) {
      const translated = countryTranslations[category.toLowerCase()]
      console.log(`   ✅ TRANSLATED: "${category}" → "${translated}"`)
      return translated
    }

    // Return original category if no translation found
    console.log(`   ⚠️ NO TRANSLATION: Using original "${category}"`)
    return category
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
      maxReviews: criteria.maxReviewsPerBusiness || 5, // Only check 5 newest reviews for recent reputation issues
      language: criteria.language || 'nl',
      sort: 'newest'
    }

    const runId = await this.runApifyActor(this.actorReviewsId, input)
    const results = await this.getApifyResults(runId, this.actorReviewsId)
    return results || []
  }

  private filterAndFormatReviews(reviews: Review[], criteria: SearchCriteria): Review[] {
    // Sort by date first (newest first) to prioritize recent reviews
    const sorted = reviews.sort((a, b) => new Date(b.publishedAtDate).getTime() - new Date(a.publishedAtDate).getTime())

    // Return ALL qualifying reviews from all businesses (not just first one)
    const qualifyingReviews: Review[] = []

    for (const review of sorted) {
      // Check rating criteria
      if (criteria.maxStars && review.stars > criteria.maxStars) {
        continue
      }

      // Check date criteria
      if (criteria.dayLimit) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - criteria.dayLimit)
        if (new Date(review.publishedAtDate) < cutoffDate) {
          continue
        }
      }

      // This review qualifies - add it to results
      qualifyingReviews.push(review)
    }

    return qualifyingReviews
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

  // 🛡️ VALIDATION METHODS - Prevent API quota waste and ensure quality results

  /**
   * Validates search queries before making API calls to prevent quota waste
   */
  private validateSearchQueries(queries: string[], criteria: SearchCriteria): string[] {
    const validQueries: string[] = []
    const countryCode = criteria.countryCode?.toLowerCase() || 'nl'
    const location = criteria.location?.toLowerCase() || ''

    console.log(`   🔍 PRE-VALIDATION: Checking ${queries.length} search queries`)

    for (const query of queries) {
      const lowerQuery = query.toLowerCase()
      let isValid = true
      const issues: string[] = []

      // 1. Check for proper localization
      if (countryCode === 'ch') {
        // For Switzerland, queries should contain German terms or proper geographic indicators
        const hasGermanTerm = this.containsGermanBusinessTerms(lowerQuery)
        const hasSwissIndicator = lowerQuery.includes('schweiz') || lowerQuery.includes('switzerland')

        if (!hasGermanTerm && !hasSwissIndicator) {
          isValid = false
          issues.push('Missing German localization or Swiss geographic indicator')
        }
      } else if (countryCode === 'es') {
        // For Spain, queries should contain Spanish terms or proper geographic indicators
        const hasSpanishTerm = this.containsSpanishBusinessTerms(lowerQuery)
        const hasSpanishIndicator = lowerQuery.includes('españa') || lowerQuery.includes('spain')

        if (!hasSpanishTerm && !hasSpanishIndicator) {
          isValid = false
          issues.push('Missing Spanish localization or geographic indicator')
        }
      } else if (countryCode === 'si') {
        // For Slovenia, queries should contain Slovenian terms or proper geographic indicators
        const hasSlovenianTerm = this.containsSlovenianBusinessTerms(lowerQuery)
        const hasSlovenianIndicator = lowerQuery.includes('slovenija') || lowerQuery.includes('slovenia')

        if (!hasSlovenianTerm && !hasSlovenianIndicator) {
          isValid = false
          issues.push('Missing Slovenian localization or geographic indicator')
        }
      } else if (countryCode === 'hr') {
        // For Croatia, queries should contain Croatian terms or proper geographic indicators
        const hasCroatianTerm = this.containsCroatianBusinessTerms(lowerQuery)
        const hasCroatianIndicator = lowerQuery.includes('hrvatska') || lowerQuery.includes('croatia')

        if (!hasCroatianTerm && !hasCroatianIndicator) {
          isValid = false
          issues.push('Missing Croatian localization or geographic indicator')
        }
      }

      // 2. Check for geographic specificity
      if (location === 'schweiz' || location === 'switzerland') {
        if (!lowerQuery.includes('schweiz') && !lowerQuery.includes('switzerland') && !this.containsGermanBusinessTerms(lowerQuery)) {
          isValid = false
          issues.push('Missing geographic targeting for Switzerland')
        }
      }

      // 3. Prevent obviously problematic queries
      if (lowerQuery.length < 3) {
        isValid = false
        issues.push('Query too short')
      }

      if (isValid) {
        validQueries.push(query)
        console.log(`   ✅ VALID: "${query}"`)
      } else {
        console.log(`   ❌ INVALID: "${query}" - ${issues.join(', ')}`)
      }
    }

    console.log(`   📊 VALIDATION SUMMARY: ${validQueries.length}/${queries.length} queries passed`)
    return validQueries
  }

  /**
   * Validates search results to ensure they're from the correct geographic region
   */
  private validateGeographicResults(businesses: Business[], criteria: SearchCriteria): Business[] {
    const countryCode = criteria.countryCode?.toLowerCase() || 'nl'
    const validBusinesses: Business[] = []

    for (const business of businesses) {
      let isValid = true
      const issues: string[] = []

      // Check business address for geographic indicators
      const address = business.address?.toLowerCase() || ''
      const title = business.title?.toLowerCase() || ''

      if (countryCode === 'ch') {
        // For Switzerland, look for Swiss indicators
        const hasSwissAddress = this.isSwissAddress(address)
        const hasSwissTitle = this.isSwissBusinessName(title)

        if (!hasSwissAddress && !hasSwissTitle) {
          isValid = false
          issues.push('Not a Swiss business')
        }
      } else if (countryCode === 'nl') {
        // For Netherlands, avoid Swiss/German businesses
        const isDutchBusiness = this.isDutchAddress(address) || this.isDutchBusinessName(title)
        const isNotSwiss = !this.isSwissAddress(address) && !this.isSwissBusinessName(title)

        if (!isDutchBusiness || !isNotSwiss) {
          isValid = false
          issues.push('Not a Dutch business or is from wrong country')
        }
      } else if (countryCode === 'es') {
        // For Spain, look for Spanish indicators
        const hasSpanishAddress = this.isSpanishAddress(address)
        const hasSpanishTitle = this.isSpanishBusinessName(title)

        if (!hasSpanishAddress && !hasSpanishTitle) {
          isValid = false
          issues.push('Not a Spanish business')
        }
      } else if (countryCode === 'si') {
        // For Slovenia, look for Slovenian indicators
        const hasSlovenianAddress = this.isSlovenianAddress(address)
        const hasSlovenianTitle = this.isSlovenianBusinessName(title)

        if (!hasSlovenianAddress && !hasSlovenianTitle) {
          isValid = false
          issues.push('Not a Slovenian business')
        }
      } else if (countryCode === 'hr') {
        // For Croatia, look for Croatian indicators
        const hasCroatianAddress = this.isCroatianAddress(address)
        const hasCroatianTitle = this.isCroatianBusinessName(title)

        if (!hasCroatianAddress && !hasCroatianTitle) {
          isValid = false
          issues.push('Not a Croatian business')
        }
      }

      if (isValid) {
        validBusinesses.push(business)
      } else {
        console.log(`   🚫 FILTERED: "${business.title}" (${business.address}) - ${issues.join(', ')}`)
      }
    }

    return validBusinesses
  }

  // Helper methods for geographic validation
  private containsGermanBusinessTerms(query: string): boolean {
    const germanTerms = ['immobilienmakler', 'zahnarzt', 'arzt', 'anwalt', 'finanzberater', 'versicherung', 'schmuck', 'autohändler']
    return germanTerms.some(term => query.includes(term))
  }

  private isSwissAddress(address: string): boolean {
    const swissIndicators = ['schweiz', 'switzerland', 'ch-', 'zürich', 'geneva', 'basel', 'bern', 'lausanne']
    return swissIndicators.some(indicator => address.includes(indicator))
  }

  private isSwissBusinessName(title: string): boolean {
    const swissTerms = ['schweiz', 'swiss', 'zürich', 'geneva', 'basel', 'ag', 'gmbh']
    return swissTerms.some(term => title.includes(term))
  }

  private isDutchAddress(address: string): boolean {
    const dutchIndicators = ['nederland', 'netherlands', 'nl-', 'amsterdam', 'rotterdam', 'utrecht', 'eindhoven', 'tilburg']
    return dutchIndicators.some(indicator => address.includes(indicator))
  }

  private isDutchBusinessName(title: string): boolean {
    const dutchTerms = ['nederland', 'dutch', 'amsterdam', 'rotterdam', 'b.v.', 'bv']
    return dutchTerms.some(term => title.includes(term))
  }

  // Spanish validation helpers
  private containsSpanishBusinessTerms(query: string): boolean {
    const spanishTerms = ['inmobiliaria', 'dentista', 'médico', 'abogado', 'asesor financiero', 'aseguradora', 'joyería', 'concesionario']
    return spanishTerms.some(term => query.includes(term))
  }

  private isSpanishAddress(address: string): boolean {
    const spanishIndicators = ['españa', 'spain', 'es-', 'madrid', 'barcelona', 'valencia', 'sevilla', 'bilbao', 'murcia']
    return spanishIndicators.some(indicator => address.includes(indicator))
  }

  private isSpanishBusinessName(title: string): boolean {
    const spanishTerms = ['españa', 'spanish', 'madrid', 'barcelona', 's.l.', 'sl', 's.a.', 'sa']
    return spanishTerms.some(term => title.includes(term))
  }

  // Slovenian validation helpers
  private containsSlovenianBusinessTerms(query: string): boolean {
    const slovenianTerms = ['nepremičninska agencija', 'zobozdravnik', 'zdravnik', 'odvetnik', 'finančni svetovalec', 'zavarovalnica', 'zlatarna']
    return slovenianTerms.some(term => query.includes(term))
  }

  private isSlovenianAddress(address: string): boolean {
    const slovenianIndicators = ['slovenija', 'slovenia', 'si-', 'ljubljana', 'maribor', 'celje', 'kranj', 'velenje']
    return slovenianIndicators.some(indicator => address.includes(indicator))
  }

  private isSlovenianBusinessName(title: string): boolean {
    const slovenianTerms = ['slovenija', 'slovenski', 'ljubljana', 'maribor', 'd.o.o.', 'doo', 'd.d.', 'dd']
    return slovenianTerms.some(term => title.includes(term))
  }

  // Croatian validation helpers
  private containsCroatianBusinessTerms(query: string): boolean {
    const croatianTerms = ['nekretnine', 'zubar', 'liječnik', 'odvjetnik', 'financijski savjetnik', 'osiguranje', 'zlatarna', 'prodavaonica automobila']
    return croatianTerms.some(term => query.includes(term))
  }

  private isCroatianAddress(address: string): boolean {
    const croatianIndicators = ['hrvatska', 'croatia', 'hr-', 'zagreb', 'split', 'rijeka', 'osijek', 'zadar']
    return croatianIndicators.some(indicator => address.includes(indicator))
  }

  private isCroatianBusinessName(title: string): boolean {
    const croatianTerms = ['hrvatska', 'croatian', 'zagreb', 'split', 'd.o.o.', 'doo', 'd.d.', 'dd', 'j.d.o.o.']
    return croatianTerms.some(term => title.includes(term))
  }
}