/**
 * Optimized Database-Aware Review Extractor
 * Uses PostgreSQL cache to minimize API costs
 *
 * COST SAVINGS:
 * - Uses cached placeIDs (saves Google Maps API calls)
 * - Filters duplicate reviews (saves processing)
 * - Incremental updates (only fetch new reviews)
 * - Multi-tenant data sharing (shared business cache)
 */

import { businessCache, CachedBusiness } from './business-cache';
import { reviewCache } from './review-cache';
import { db, transaction } from '../../../database/db';
import { PoolClient } from 'pg';
import { CategoryTranslator } from './category-translator';
import { UniversalBusinessReviewExtractor } from '../extractor';
import { SmartCrawlOptimizer } from './smart-crawl-optimizer';

export interface ExtractionOptions {
  organizationId: string; // Required for multi-tenant
  category: string;
  location: string;
  countryCode?: string;
  maxBusinessRating?: number;
  maxReviewStars?: number;
  dayLimit?: number;
  businessLimit?: number;
  maxReviewsPerBusiness?: number;
  language?: string;
  useCache?: boolean; // Default: true
  forceRefresh?: boolean; // Force re-fetch even if cached
}

export interface ExtractionResult {
  extraction_id: string;
  organization_id: string;
  businesses: {
    total: number;
    cached: number;
    new: number;
    businesses: CachedBusiness[];
  };
  reviews: {
    total: number;
    cached: number;
    new: number;
    reviews: any[];
  };
  cost: {
    apify_credits: number;
    apify_cost_usd: number;
    savings_usd: number; // Money saved by using cache
  };
  performance: {
    duration_ms: number;
    cache_hit_rate: number;
  };
}

class OptimizedExtractor {
  /**
   * Main extraction method with database optimization
   */
  async extract(options: ExtractionOptions): Promise<ExtractionResult> {
    const startTime = Date.now();
    const useCache = options.useCache !== false; // Default true

    console.log(`\n🚀 OPTIMIZED EXTRACTION STARTED`);
    console.log(`Organization: ${options.organizationId}`);
    console.log(`Cache enabled: ${useCache}`);
    console.log(`Force refresh: ${options.forceRefresh || false}\n`);

    // Create extraction record
    const extractionId = await this.createExtractionRecord(options);

    try {
      // Step 1: Check cache for existing businesses
      let businessesToProcess: CachedBusiness[] = [];
      let cachedBusinessCount = 0;
      let newBusinessCount = 0;

      if (useCache && !options.forceRefresh) {
        console.log('📊 Checking business cache...');

        // Translate category to Dutch for cache search (database has Dutch categories)
        const normalizedCategory = CategoryTranslator.normalizeForCache(options.category);
        console.log(`🔤 Category translation: "${options.category}" → "${normalizedCategory}"`);

        const cachedBusinesses = await businessCache.searchCached({
          category: normalizedCategory,
          city: options.location,
          country_code: options.countryCode || 'nl',
          // DON'T filter by rating in cache - a 5★ business can have bad reviews!
          // max_rating: options.maxBusinessRating || 4.6,
          // DON'T filter by review count - we want ALL cached businesses
          // min_reviews: 1,
          limit: options.businessLimit || 50
        });

        cachedBusinessCount = cachedBusinesses.length;
        businessesToProcess = cachedBusinesses;

        console.log(`💾 Found ${cachedBusinessCount} businesses in cache`);
      }

      // Step 2: If not enough cached businesses, fetch from Apify
      let apifyCredits = 0;
      let apifyCost = 0;

      if (businessesToProcess.length < (options.businessLimit || 50)) {
        console.log('\n📡 Fetching businesses from Apify...');

        try {
          // Initialize smart crawl optimizer
          const smartOptimizer = new SmartCrawlOptimizer({
            consecutiveZeroThreshold: 20,
            rollingWindowSize: 50,
            minRollingWindowQuality: 0.25,
            minBusinessesBeforeStopping: 100,
            maxCostPerQualifyingBusiness: 0.15,
            costPerBusinessCrawl: 0.03
          });

          // Use the original extractor for Apify calls
          const apifyExtractor = new UniversalBusinessReviewExtractor();

          // Use findBusinesses method which returns array of businesses
          const apifyResults = await apifyExtractor.findBusinesses({
            category: options.category,
            location: options.location,
            countryCode: options.countryCode || 'nl',
            minRating: undefined, // We'll filter later
            businessLimit: options.businessLimit || 50,
            maxStars: options.maxReviewStars,
            dayLimit: options.dayLimit
          });

          // Apply smart stopping logic to filter results
          if (apifyResults && apifyResults.length > 0) {
            console.log(`\n🎯 Applying smart crawl optimization to ${apifyResults.length} results...`);

            const filteredResults: any[] = [];
            let stoppedEarly = false;
            let stopReason = '';
            let projectedSavings = 0;

            for (const business of apifyResults) {
              const hasReviews = (business.reviewsCount || 0) > 0;

              // Check if we should stop crawling
              const decision = smartOptimizer.processBusinessAndCheckStop(hasReviews);

              if (decision.shouldStop && !stoppedEarly) {
                stoppedEarly = true;
                stopReason = decision.reason || 'Quality threshold reached';
                projectedSavings = decision.projectedSavings || 0;

                console.log(`\n🛑 SMART STOP TRIGGERED`);
                console.log(`   Reason: ${stopReason}`);
                console.log(`   Processed: ${filteredResults.length} businesses`);
                console.log(`   Skipped: ${apifyResults.length - filteredResults.length} businesses`);
                console.log(`   💰 Projected savings: $${projectedSavings.toFixed(2)}`);
                console.log(`   📊 Quality rate: ${(decision.metrics.withReviews / decision.metrics.totalCrawled * 100).toFixed(1)}%`);
                break;
              }

              filteredResults.push(business);
            }

            const stats = smartOptimizer.getStatistics();
            console.log(`\n📊 Smart Crawl Statistics:`);
            console.log(`   Total processed: ${stats.totalCrawled}`);
            console.log(`   With reviews: ${stats.withReviews} (${(stats.qualityRate * 100).toFixed(1)}%)`);
            console.log(`   Without reviews: ${stats.withoutReviews}`);
            if (stoppedEarly) {
              console.log(`   💸 Estimated savings: $${projectedSavings.toFixed(2)}`);
            }

            // Cache only the filtered businesses
            console.log(`\n💾 Caching ${filteredResults.length} qualifying businesses...`);

            for (const business of filteredResults) {
              await businessCache.upsert({
                place_id: business.placeId,
                name: business.title,
                category: business.categoryName,
                address: business.address,
                city: business.city,
                postal_code: business.postalCode,
                country_code: business.countryCode || options.countryCode || 'nl',
                phone: business.phone,
                website: business.website,
                rating: business.totalScore,
                reviews_count: business.reviewsCount,
                google_maps_url: business.url,
                raw_data: business
              });
            }

            newBusinessCount = filteredResults.length;

            // Get cached versions
            const placeIds = filteredResults.map((b: any) => b.placeId);
            const searchResult = await businessCache.findByPlaceIds(placeIds);
            businessesToProcess = searchResult.cached;
          }

          // Estimate Apify cost (Google Maps search)
          // NOTE: Apify charges for all results returned, not just what we process
          // But we save on review extraction and database storage costs
          apifyCredits += apifyResults.length * 0.03; // ~$0.03 per business
          apifyCost = apifyCredits;
        } catch (apifyError: any) {
          console.log(`   ⚠️  Apify API unavailable: ${apifyError.message}`);
          console.log(`   ℹ️  Continuing with ${businessesToProcess.length} cached businesses`);
          // Continue with whatever cached data we have
        }
      }

      console.log(`\n📊 Business Summary:`);
      console.log(`   Cached: ${cachedBusinessCount}`);
      console.log(`   New: ${newBusinessCount}`);
      console.log(`   Total: ${businessesToProcess.length}`);

      // Step 3: Extract reviews with incremental updates
      console.log(`\n📝 Extracting reviews...`);

      const allReviews: any[] = [];
      let totalNewReviews = 0;
      let totalCachedReviews = 0;

      for (const business of businessesToProcess) {
        console.log(`\n[Business] ${business.name}`);

        // Check what reviews we already have
        const existingReviews = await reviewCache.getForBusiness(business.id, {
          max_stars: options.maxReviewStars || 3,
          start_date: new Date(Date.now() - (options.dayLimit || 14) * 24 * 60 * 60 * 1000)
        });

        console.log(`  💾 Found ${existingReviews.length} cached reviews`);

        // Determine if we need to fetch new reviews
        const latestReviewDate = await reviewCache.getLatestReviewDate(business.id);
        const daysSinceLastReview = latestReviewDate
          ? Math.floor((Date.now() - latestReviewDate.getTime()) / (24 * 60 * 60 * 1000))
          : 999;

        let fetchedReviews: any[] = [];

        // Only fetch if:
        // 1. Force refresh enabled, OR
        // 2. No cached reviews, OR
        // 3. Last review is old (>3 days)
        if (options.forceRefresh || existingReviews.length === 0 || daysSinceLastReview > 3) {
          console.log(`  📡 Fetching new reviews from Apify...`);

          try {
            const apifyExtractor = new UniversalBusinessReviewExtractor();

            fetchedReviews = await apifyExtractor.extractReviewsFromBusiness(
              {
                placeId: business.place_id,
                title: business.name,
                address: business.address || '',
                totalScore: business.rating || 0,
                reviewsCount: business.reviews_count || 0
              },
              {
                maxStars: options.maxReviewStars || 3,
                maxReviewsPerBusiness: options.maxReviewsPerBusiness || 2, // Default: 2 reviews (cost optimization)
                language: options.language || 'nl',
                dayLimit: options.dayLimit || 14
              } as any
            );

            // Filter for new reviews only
            const delta = await reviewCache.filterNewReviews(business.id, fetchedReviews);
            console.log(`  🔍 ${delta.stats.new_count} new / ${delta.stats.duplicate_count} duplicates`);

            // Cache new reviews
            if (delta.new_reviews.length > 0) {
              await reviewCache.insertBatch(business.id, delta.new_reviews);
              totalNewReviews += delta.new_reviews.length;
            }

            totalCachedReviews += delta.stats.duplicate_count;

            // Estimate Apify cost (review extraction)
            apifyCredits += 0.02; // ~$0.02 per business for review extraction
            apifyCost = apifyCredits;
          } catch (reviewError: any) {
            console.log(`  ⚠️  Apify API unavailable for reviews: ${reviewError.message}`);
            console.log(`  ℹ️  Using ${existingReviews.length} cached reviews`);
            totalCachedReviews += existingReviews.length;
          }

        } else {
          console.log(`  ✅ Using cached reviews (last updated ${daysSinceLastReview} days ago)`);
          totalCachedReviews += existingReviews.length;
        }

        // Get all reviews for this business (cached + new)
        const businessReviews = await reviewCache.getForBusiness(business.id, {
          max_stars: options.maxReviewStars || 3,
          start_date: new Date(Date.now() - (options.dayLimit || 14) * 24 * 60 * 60 * 1000),
          limit: options.maxReviewsPerBusiness || 2 // Default: 2 reviews (cost optimization)
        });

        allReviews.push(...businessReviews);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Step 4: Calculate savings
      const potentialCost = businessesToProcess.length * 0.05; // What it would cost without cache
      const savingsUsd = potentialCost - apifyCost;

      console.log(`\n💰 COST ANALYSIS:`);
      console.log(`   Apify credits used: ${apifyCredits.toFixed(4)}`);
      console.log(`   Actual cost: $${apifyCost.toFixed(2)}`);
      console.log(`   Potential cost (no cache): $${potentialCost.toFixed(2)}`);
      console.log(`   💸 SAVINGS: $${savingsUsd.toFixed(2)} (${((savingsUsd / potentialCost) * 100).toFixed(1)}%)`);

      // Step 5: Update extraction record
      const duration = Date.now() - startTime;
      const cacheHitRate = cachedBusinessCount / (cachedBusinessCount + newBusinessCount || 1);

      await this.updateExtractionRecord(extractionId, {
        businesses_found: businessesToProcess.length,
        reviews_extracted: allReviews.length,
        new_businesses: newBusinessCount,
        cached_businesses: cachedBusinessCount,
        new_reviews: totalNewReviews,
        apify_credits_used: apifyCredits,
        apify_cost_usd: apifyCost,
        status: 'completed',
        completed_at: new Date()
      });

      console.log(`\n✅ EXTRACTION COMPLETED in ${(duration / 1000).toFixed(1)}s`);
      console.log(`   Cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`);

      return {
        extraction_id: extractionId,
        organization_id: options.organizationId,
        businesses: {
          total: businessesToProcess.length,
          cached: cachedBusinessCount,
          new: newBusinessCount,
          businesses: businessesToProcess
        },
        reviews: {
          total: allReviews.length,
          cached: totalCachedReviews,
          new: totalNewReviews,
          reviews: allReviews
        },
        cost: {
          apify_credits: apifyCredits,
          apify_cost_usd: apifyCost,
          savings_usd: savingsUsd
        },
        performance: {
          duration_ms: duration,
          cache_hit_rate: cacheHitRate
        }
      };

    } catch (error: any) {
      console.error('❌ Extraction failed:', error);

      // Update extraction record with error
      await this.updateExtractionRecord(extractionId, {
        status: 'failed',
        error_message: error.message,
        completed_at: new Date()
      });

      throw error;
    }
  }

  /**
   * Create extraction record in database
   */
  private async createExtractionRecord(options: ExtractionOptions): Promise<string> {
    const result = await db.query(`
      INSERT INTO extractions (
        organization_id,
        search_criteria,
        extraction_type,
        status,
        started_at
      ) VALUES ($1, $2::jsonb, $3, $4, NOW())
      RETURNING id
    `, [
      options.organizationId,
      JSON.stringify(options),
      'manual',
      'in_progress'
    ]);

    return result.rows[0].id;
  }

  /**
   * Update extraction record
   */
  private async updateExtractionRecord(extractionId: string, updates: any): Promise<void> {
    const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = Object.values(updates);

    await db.query(`
      UPDATE extractions
      SET ${fields}
      WHERE id = $1
    `, [extractionId, ...values]);
  }
}

export const optimizedExtractor = new OptimizedExtractor();
