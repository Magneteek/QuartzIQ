/**
 * Universal Search Extractor
 * Flexible search system supporting multiple use cases:
 * - Lead generation (just contacts, no reviews)
 * - Review analysis (bad reviews for reputation management)
 * - Market research (all businesses in area)
 * - Review momentum tracking (trending businesses)
 */

import { UniversalSearchCriteria, UniversalSearchResponse, BusinessWithMomentum } from '../types/universal-search'
import { UniversalBusinessReviewExtractor } from '../extractor'
import { businessCache } from './business-cache'
import { reviewMomentumAnalyzer } from './review-momentum-analyzer'
import { reviewStorage } from './review-storage'
import { logger } from '../logger'

const universalLogger = logger.child({ module: 'universal-search' })

export class UniversalSearchExtractor {
  /**
   * Main search method - handles all use cases
   */
  async search(criteria: UniversalSearchCriteria): Promise<UniversalSearchResponse> {
    const startTime = Date.now()

    universalLogger.info('Starting universal search', {
      category: criteria.category,
      location: criteria.location,
      enrichmentEnabled: criteria.enrichment?.enabled,
      reviewsEnabled: criteria.reviewFilters?.enabled,
      momentumEnabled: criteria.businessFilters?.reviewMomentum?.enabled,
    })

    try {
      // Step 1: Find businesses (with optional Apify enrichment)
      universalLogger.info('Finding businesses', { step: 1, useCached: criteria.useCached })

      let businesses: BusinessWithMomentum[]

      if (criteria.useCached) {
        // ✅ CACHE-ONLY MODE: Skip Google Maps, use database
        universalLogger.info('Using cached businesses only (no Google Maps search)')
        businesses = await this.findCachedBusinesses(criteria)
        universalLogger.info('Cached businesses loaded', { step: 1, count: businesses.length })

        // ✅ NEW: Run enrichment on cached businesses if enabled
        if (criteria.enrichment?.enabled && criteria.enrichment?.apifyEnrichment?.enabled) {
          universalLogger.info('Running enrichment on cached businesses', { step: '1b', count: businesses.length })
          businesses = await this.enrichCachedBusinesses(businesses, criteria)
          universalLogger.info('Enrichment complete', { step: '1b', enriched: businesses.filter(b => b.contactEnriched).length })
        }
      } else {
        // Regular mode: Search Google Maps
        businesses = await this.findBusinesses(criteria)
        universalLogger.info('Businesses found', { step: 1, count: businesses.length })
      }

      // Step 2: Apply business filters (rating, review count, etc.)
      let filteredBusinesses = await this.applyBusinessFilters(businesses, criteria)
      universalLogger.info('Business filters applied', {
        step: 2,
        originalCount: businesses.length,
        filteredCount: filteredBusinesses.length,
      })

      // Step 3: Filter by review momentum if requested
      if (criteria.businessFilters?.reviewMomentum?.enabled) {
        universalLogger.info('Analyzing review momentum', { step: 3 })
        filteredBusinesses = await reviewMomentumAnalyzer.filterByMomentum(
          filteredBusinesses,
          criteria.businessFilters.reviewMomentum
        )
        universalLogger.info('Momentum filtering complete', {
          step: 3,
          count: filteredBusinesses.length,
        })
      }

      // Step 4: Extract reviews (ONLY if enabled)
      let reviews: any[] = []
      if (criteria.reviewFilters?.enabled) {
        universalLogger.info('Extracting reviews', { step: 4 })
        reviews = await this.extractReviews(filteredBusinesses, criteria)
        universalLogger.info('Reviews extracted', { step: 4, count: reviews.length })
      } else {
        universalLogger.info('Skipping review extraction (disabled)', { step: 4 })
      }

      // Step 5: Calculate stats
      const stats = this.calculateStats(filteredBusinesses, reviews, criteria)

      // Step 6: Format response
      const response: UniversalSearchResponse = {
        success: true,
        businesses: filteredBusinesses,
        reviews: criteria.output?.includeReviews ? reviews : undefined,
        searchCriteria: criteria,
        extractionDate: new Date(),
        stats,
      }

      const duration = Date.now() - startTime
      universalLogger.info('Universal search complete', {
        duration: `${(duration / 1000).toFixed(2)}s`,
        businesses: filteredBusinesses.length,
        reviews: reviews.length,
        totalCost: `$${stats.totalCostUsd}`,
      })

      return response

    } catch (error) {
      universalLogger.error('Universal search failed', {
        error: error instanceof Error ? error.message : String(error),
        category: criteria.category,
        location: criteria.location,
      })
      throw error
    }
  }

  /**
   * Find cached businesses from database (skip Google Maps)
   */
  private async findCachedBusinesses(criteria: UniversalSearchCriteria): Promise<BusinessWithMomentum[]> {
    const limit = criteria.limits?.maxBusinesses || 50

    // ✅ TRANSLATE CATEGORY: Apply same translation as Google Maps search
    const translatedCategory = this.translateCategory(criteria.category, criteria.countryCode || 'nl')

    universalLogger.info('Cache query with translation', {
      originalCategory: criteria.category,
      translatedCategory,
      countryCode: criteria.countryCode || 'nl',
    })

    // Query database for cached businesses
    const cachedBusinesses = await businessCache.searchCached({
      category: translatedCategory,
      city: criteria.location,
      country_code: criteria.countryCode || 'nl',
      limit: limit,
    })

    universalLogger.info('Cache query complete', {
      requested: limit,
      found: cachedBusinesses.length,
    })

    // Convert to BusinessWithMomentum format
    return cachedBusinesses.map((business: any) => ({
      id: business.id,
      placeId: business.place_id,
      title: business.name,
      totalScore: business.rating || 0,
      reviewsCount: business.reviews_count || 0,
      address: business.address,
      phone: business.phone,
      website: business.website,
      email: business.email,
      url: business.google_maps_url,
      category: business.category,
      city: business.city,
      // Enrichment fields
      email_enriched: business.email_enriched,
      emailEnriched: business.email_enriched,
      emailSource: business.email_source,
      emailConfidence: business.email_confidence,
      contactEnriched: !!business.email_enriched,
      enrichmentDate: business.last_enriched_at,
      lastEnrichedAt: business.last_enriched_at,
    }))
  }

  /**
   * Enrich cached businesses with Apify contact data
   */
  private async enrichCachedBusinesses(
    businesses: BusinessWithMomentum[],
    criteria: UniversalSearchCriteria
  ): Promise<BusinessWithMomentum[]> {
    const extractor = new UniversalBusinessReviewExtractor()
    const enrichedBusinesses: BusinessWithMomentum[] = []

    for (const business of businesses) {
      try {
        // Skip if already enriched recently (within last 30 days)
        if (business.lastEnrichedAt) {
          const daysSinceEnrichment = Math.floor(
            (Date.now() - new Date(business.lastEnrichedAt).getTime()) / (1000 * 60 * 60 * 24)
          )
          if (daysSinceEnrichment < 30) {
            universalLogger.debug('Skipping recently enriched business', {
              business: business.title,
              daysSinceEnrichment,
            })
            enrichedBusinesses.push(business)
            continue
          }
        }

        // Call Apify enrichment using searchGoogleMaps with enrichment enabled
        universalLogger.debug('Enriching business', { business: business.title })

        // Use the business name + city as search query for precise match
        const searchQuery = `${business.title} ${business.city || business.address}`
        const results = await extractor['searchGoogleMaps'](
          searchQuery,
          1, // Only need 1 result (exact match)
          criteria.countryCode || 'nl',
          criteria.language || 'en',
          true // Enable enrichment
        )

        if (results && results.length > 0) {
          const enrichedData = results[0]

          // Merge enriched data with cached business
          const enrichedBusiness: BusinessWithMomentum = {
            ...business,
            email: enrichedData.email || business.email,
            emailEnriched: enrichedData.email || business.emailEnriched,
            emailSource: enrichedData.email ? 'apify' : business.emailSource,
            emailConfidence: enrichedData.email ? 'medium' : business.emailConfidence,
            socialMedia: enrichedData.socialMedia || business.socialMedia,
            contactEnriched: !!(enrichedData.email || enrichedData.socialMedia?.facebook || enrichedData.socialMedia?.linkedin),
            enrichmentDate: new Date(),
            lastEnrichedAt: new Date(),
            enrichmentProvider: 'apify',
            enrichmentCostUsd: 0.005, // $0.005 per enrichment
          }

          // Update database with enrichment data
          if (business.id) {
            await businessCache.upsert({
              place_id: business.placeId,
              name: business.title,
              category: business.category,
              city: business.city,
              address: business.address,
              rating: business.totalScore,
              reviews_count: business.reviewsCount,
              phone: business.phone,
              website: business.website,
              email: enrichedData.email || business.email,
              google_maps_url: business.url,
              country_code: criteria.countryCode || 'nl',
              // Enrichment data
              email_enriched: enrichedData.email,
              email_source: enrichedData.email ? 'apify' : undefined,
              email_confidence: enrichedData.email ? 'medium' : undefined,
              facebook_url: enrichedData.socialMedia?.facebook,
              linkedin_url: enrichedData.socialMedia?.linkedin,
              instagram_url: enrichedData.socialMedia?.instagram,
              twitter_url: enrichedData.socialMedia?.twitter,
              enrichment_provider: 'apify',
              enrichment_cost_usd: 0.005,
            })
          }

          enrichedBusinesses.push(enrichedBusiness)
          universalLogger.debug('Business enriched', {
            business: business.title,
            hasEmail: !!enrichedData.email,
            hasSocial: !!(enrichedData.socialMedia?.facebook || enrichedData.socialMedia?.linkedin),
          })
        } else {
          // No enrichment data found, keep original
          enrichedBusinesses.push(business)
        }

        // Rate limiting between enrichments
        await this.delay(2000)
      } catch (error: any) {
        universalLogger.warn('Enrichment failed for business', {
          business: business.title,
          error: error.message,
        })
        // On error, keep original business
        enrichedBusinesses.push(business)
      }
    }

    return enrichedBusinesses
  }

  /**
   * Find businesses using existing extractor with enrichment support
   */
  private async findBusinesses(criteria: UniversalSearchCriteria): Promise<BusinessWithMomentum[]> {
    const extractor = new UniversalBusinessReviewExtractor()

    // Convert to legacy format for extractor
    const legacyCriteria = {
      category: criteria.category,
      location: criteria.location,
      businessLimit: criteria.limits?.maxBusinesses || 50,
      language: criteria.language || 'en',
      countryCode: criteria.countryCode || 'nl',
      multiLanguageSearch: criteria.businessFilters?.multiLanguageSearch || false,
      // Pass enrichment flag to extractor
      enrichment: criteria.enrichment,
    }

    // This will call searchGoogleMaps with enrichment enabled
    const businesses = await extractor.findBusinesses(legacyCriteria)

    // Convert to BusinessWithMomentum format
    return businesses.map(business => ({
      ...business,
      // ✅ Preserve database ID from cache for momentum tracking (set by extractor)
      id: business.id,
      email_enriched: business.email,
      emailEnriched: business.email,
      emailSource: business.email ? 'apify' : undefined,
      emailConfidence: business.email ? 'medium' : undefined,
      contactEnriched: business.contactEnriched,
      enrichmentDate: business.enrichmentDate,
    }))
  }

  /**
   * Apply business filters (rating, review count, website, phone)
   */
  private async applyBusinessFilters(
    businesses: BusinessWithMomentum[],
    criteria: UniversalSearchCriteria
  ): Promise<BusinessWithMomentum[]> {
    let filtered = businesses

    const filters = criteria.businessFilters
    if (!filters) return filtered

    // Rating filters
    if (filters.minRating !== undefined) {
      const before = filtered.length
      filtered = filtered.filter(b => b.totalScore >= filters.minRating!)
      universalLogger.debug('Applied minRating filter', {
        minRating: filters.minRating,
        removed: before - filtered.length,
      })
    }
    if (filters.maxRating !== undefined) {
      const before = filtered.length
      filtered = filtered.filter(b => b.totalScore <= filters.maxRating!)
      universalLogger.debug('Applied maxRating filter', {
        maxRating: filters.maxRating,
        removed: before - filtered.length,
      })
    }

    // Review count filters
    if (filters.minReviewCount !== undefined) {
      const before = filtered.length
      filtered = filtered.filter(b => b.reviewsCount >= filters.minReviewCount!)
      universalLogger.debug('Applied minReviewCount filter', {
        minReviewCount: filters.minReviewCount,
        removed: before - filtered.length,
      })
    }
    if (filters.maxReviewCount !== undefined) {
      const before = filtered.length
      filtered = filtered.filter(b => b.reviewsCount <= filters.maxReviewCount!)
      universalLogger.debug('Applied maxReviewCount filter', {
        maxReviewCount: filters.maxReviewCount,
        removed: before - filtered.length,
      })
    }

    // Website/phone filters
    if (filters.mustHaveWebsite) {
      const before = filtered.length
      filtered = filtered.filter(b => b.website)
      universalLogger.debug('Applied mustHaveWebsite filter', {
        removed: before - filtered.length,
      })
    }
    if (filters.mustHavePhone) {
      const before = filtered.length
      filtered = filtered.filter(b => b.phone)
      universalLogger.debug('Applied mustHavePhone filter', {
        removed: before - filtered.length,
      })
    }

    return filtered
  }

  /**
   * Extract reviews from businesses (using existing extractor logic)
   */
  private async extractReviews(
    businesses: BusinessWithMomentum[],
    criteria: UniversalSearchCriteria
  ): Promise<any[]> {
    const extractor = new UniversalBusinessReviewExtractor()
    const allReviews: any[] = []

    const maxReviewsPerBusiness = criteria.limits?.maxReviewsPerBusiness || 5
    const reviewFilters = criteria.reviewFilters!

    for (const business of businesses) {
      try {
        if (!business.placeId) {
          continue
        }

        const legacyCriteria = {
          category: criteria.category,
          location: criteria.location,
          language: criteria.language || 'en',
          maxReviewsPerBusiness: maxReviewsPerBusiness,
          maxStars: reviewFilters.maxStars,
          dayLimit: reviewFilters.dayLimit,
        }

        const reviews = await extractor.extractReviewsFromBusiness(
          business as any,
          legacyCriteria
        )

        // ✅ TWO-RULE QUALIFICATION SYSTEM
        const filteredReviews = reviews.filter(review => {
          return this.qualifiesReview(review, reviewFilters)
        })

        allReviews.push(...filteredReviews)

        // ✅ NEW: Store qualified reviews in database
        if (filteredReviews.length > 0 && business.id) {
          universalLogger.debug('Storing qualified reviews', {
            business: business.title,
            count: filteredReviews.length,
          })

          // Map reviews to storage format
          const reviewsToStore = filteredReviews.map((review: any) => ({
            business_id: business.id!,
            review_id: `${business.placeId}-${review.name}-${review.publishedAtDate}`,
            reviewer_name: review.name || 'Anonymous',
            rating: review.stars,
            text: review.text || '',
            published_date: new Date(review.publishedAtDate),
            language: review.originalLanguage || criteria.language || 'en',
            raw_data: review,
          }))

          // Store in database
          const { stored, duplicates } = await reviewStorage.storeReviews(reviewsToStore)
          universalLogger.debug('Reviews stored', {
            business: business.title,
            stored,
            duplicates,
          })
        }

        // Check if we've hit the global review limit
        if (criteria.limits?.maxTotalReviews) {
          if (allReviews.length >= criteria.limits.maxTotalReviews) {
            universalLogger.info('Hit maxTotalReviews limit', {
              limit: criteria.limits.maxTotalReviews,
              actual: allReviews.length,
            })
            break
          }
        }

        // Rate limiting
        await this.delay(3000)
      } catch (error: any) {
        universalLogger.warn('Review extraction failed for business', {
          business: business.title,
          error: error.message,
        })
      }
    }

    return allReviews
  }

  /**
   * ✅ TWO-RULE QUALIFICATION SYSTEM
   *
   * Rule 1: Recent reviews with content
   *   - Stars: 1-3 (negative reviews)
   *   - Age: ≤ dayLimit (e.g., 14 days)
   *   - Must have text OR image (at least one)
   *
   * Rule 2: Reviews with images (any age)
   *   - Stars: 1-3 (negative reviews)
   *   - Must have image
   *   - No age limit
   *
   * A review qualifies if it matches EITHER rule (OR logic)
   */
  private qualifiesReview(review: any, reviewFilters: any): boolean {
    // Check star rating (must be within minStars-maxStars range, typically 1-3)
    const stars = review.stars
    const minStars = reviewFilters.minStars || 1
    const maxStars = reviewFilters.maxStars || 5

    if (stars < minStars || stars > maxStars) {
      return false // Must be negative review (1-3 stars typically)
    }

    // Check for content
    const hasText = review.text && review.text.trim().length > 0
    const hasImage = review.reviewImageUrls && Array.isArray(review.reviewImageUrls) && review.reviewImageUrls.length > 0
    const hasContent = hasText || hasImage

    // Calculate age in days
    const publishedDate = new Date(review.publishedAtDate)
    const now = new Date()
    const daysSinceReview = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24))

    // Rule 1: Recent (≤ dayLimit days) + Has content (text OR image)
    const rule1 = daysSinceReview <= reviewFilters.dayLimit && hasContent

    // Rule 2: Has image (any age, no time limit)
    const rule2 = hasImage

    // Qualifies if EITHER rule is met (OR logic)
    const qualifies = rule1 || rule2

    // Optional: If mustHavePhotos is explicitly enabled, enforce stricter image requirement
    if (reviewFilters.mustHavePhotos && !hasImage) {
      return false
    }

    // Optional: If minTextLength is set, enforce text length requirement
    if (reviewFilters.minTextLength && (!review.text || review.text.length < reviewFilters.minTextLength)) {
      return false
    }

    return qualifies
  }

  /**
   * Calculate comprehensive statistics
   */
  private calculateStats(
    businesses: BusinessWithMomentum[],
    reviews: any[],
    criteria: UniversalSearchCriteria
  ) {
    const cachedBusinesses = businesses.filter(b => b.lastEnrichedAt !== undefined).length
    const enrichedBusinesses = businesses.filter(b => b.emailEnriched || b.email).length

    // ✅ IMPROVED COST CALCULATION
    let apifyCost = 0
    let enrichmentCost = 0

    if (criteria.useCached) {
      // Cache mode: $0 for business scraping, only count enrichment if enabled
      if (criteria.enrichment?.apifyEnrichment?.enabled) {
        // Count businesses that were actually enriched (newly enriched, not already cached with enrichment)
        const newlyEnriched = businesses.filter(b =>
          b.enrichmentDate &&
          new Date(b.enrichmentDate).getTime() > Date.now() - 60000 // Enriched in last minute
        ).length
        enrichmentCost = newlyEnriched * 0.005 // $0.005 per enrichment
      }
      apifyCost = 0 // No business scraping cost in cache mode
    } else {
      // Regular mode: Business scraping cost
      const enrichmentEnabled = criteria.enrichment?.apifyEnrichment?.enabled || false
      const costPerBusiness = enrichmentEnabled ? 0.009 : 0.004
      apifyCost = businesses.length * costPerBusiness
    }

    // Review extraction cost (accurate: $0.001 per API call)
    const reviewsCost = criteria.reviewFilters?.enabled
      ? businesses.length * 0.001 // $0.001 per business (review API call)
      : 0

    const apolloCost = 0 // TODO: Calculate if Apollo was used

    return {
      totalBusinesses: businesses.length,
      totalReviews: reviews.length,
      cachedBusinesses,
      newBusinesses: businesses.length - cachedBusinesses,
      enrichedBusinesses,
      apifyCostUsd: Number((apifyCost + enrichmentCost).toFixed(3)),
      apolloCostUsd: Number(apolloCost.toFixed(2)),
      totalCostUsd: Number((apifyCost + enrichmentCost + reviewsCost + apolloCost).toFixed(3)),
      cacheHitRate: Number((cachedBusinesses / businesses.length * 100 || 0).toFixed(1)),
      savingsUsd: Number((cachedBusinesses * 0.004).toFixed(3)), // Savings from not re-scraping
    }
  }

  /**
   * Helper: delay for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Translate business category to local language
   * Uses same translations as Google Maps search for consistency
   */
  private translateCategory(category: string, countryCode: string): string {
    const translations: Record<string, Record<string, string>> = {
      'nl': {
        'dentist': 'tandarts',
        'doctor': 'dokter',
        'restaurant': 'restaurant',
        'hotel': 'hotel',
        'lawyer': 'advocaat',
        'accountant': 'accountant',
        'plumber': 'loodgieter',
        'electrician': 'elektricien',
        'contractor': 'aannemer',
        'real_estate_agent': 'makelaar',
      },
      'es': {
        'dentist': 'dentista',
        'doctor': 'médico',
        'restaurant': 'restaurante',
        'hotel': 'hotel',
        'lawyer': 'abogado',
      },
      'de': {
        'dentist': 'zahnarzt',
        'doctor': 'arzt',
        'restaurant': 'restaurant',
        'hotel': 'hotel',
        'lawyer': 'anwalt',
      },
    }

    const countryTranslations = translations[countryCode.toLowerCase()]
    if (!countryTranslations) {
      return category // No translation available, return original
    }

    const translated = countryTranslations[category.toLowerCase()]
    return translated || category // Return translated or original if not found
  }
}

// Export singleton instance
export const universalSearchExtractor = new UniversalSearchExtractor()
