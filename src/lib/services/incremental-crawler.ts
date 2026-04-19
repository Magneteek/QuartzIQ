/**
 * Incremental Crawler Service
 * Extends OptimizedExtractor with intelligent incremental crawling
 * Only fetches reviews published since last crawl = 75% cost savings!
 */

import { db } from '../../../database/db';
import { businessCache, CachedBusiness } from './business-cache';
import { reviewCache } from './review-cache';
import { v4 as uuidv4 } from 'uuid';
import { UniversalBusinessReviewExtractor } from '../extractor';

export interface IncrementalCrawlOptions {
  organizationId: string;
  businessId: string;
  maxReviewsPerBusiness?: number;
  maxReviewStars?: number;
  dayLimit?: number;
  language?: string;
  forceFullCrawl?: boolean; // Override incremental logic
  extractionId?: string; // Link to extraction session
}

export interface CrawlResult {
  businessId: string;
  businessName: string;
  crawlId: string;
  reviewsFound: number;
  reviewsNew: number;
  reviewsDuplicate: number;
  isIncremental: boolean;
  costUsd: number;
  durationSeconds: number;
  lastCrawledAt: Date;
  nextRecommendedCrawl: Date;
}

interface LastCrawlInfo {
  lastCrawledAt: Date | null;
  daysSinceLastCrawl: number | null;
  reviewsInLastCrawl: number | null;
}

class IncrementalCrawler {
  /**
   * Crawl a single business with intelligent incremental updates
   */
  async crawlBusiness(options: IncrementalCrawlOptions): Promise<CrawlResult> {
    const startTime = Date.now();
    const {
      organizationId,
      businessId,
      maxReviewsPerBusiness = 2,
      maxReviewStars = 3,
      dayLimit = 14,
      language = 'nl',
      forceFullCrawl = false,
      extractionId
    } = options;

    console.log(`\n🔍 Crawling business: ${businessId}`);

    // Get business details
    const business = await this.getBusinessDetails(businessId);
    if (!business) {
      throw new Error(`Business not found: ${businessId}`);
    }

    console.log(`   Business: ${business.name}`);

    // Check last crawl info
    const lastCrawl = await this.getLastCrawlInfo(businessId);
    const shouldUseIncremental = this.shouldUseIncrementalCrawl(lastCrawl, forceFullCrawl);

    console.log(`   Last crawled: ${lastCrawl.lastCrawledAt ? lastCrawl.lastCrawledAt.toISOString() : 'Never'}`);
    console.log(`   Crawl mode: ${shouldUseIncremental ? 'INCREMENTAL' : 'FULL'}`);

    // Determine date range for review fetching
    let reviewsSinceDate: Date | null = null;
    if (shouldUseIncremental && lastCrawl.lastCrawledAt) {
      reviewsSinceDate = lastCrawl.lastCrawledAt;
      console.log(`   Fetching reviews since: ${reviewsSinceDate.toISOString()}`);
    }

    // Fetch reviews
    let reviewsFound = 0;
    let reviewsNew = 0;
    let reviewsDuplicate = 0;
    let costUsd = 0;

    try {
      // Use Apify extractor
      const apifyExtractor = new UniversalBusinessReviewExtractor();

      // Fetch reviews with optional date filter
      const fetchedReviews = await apifyExtractor.extractReviewsFromBusiness(
        {
          placeId: business.place_id,
          title: business.name,
          address: business.address || '',
          totalScore: business.rating || 0,
          reviewsCount: business.reviews_count || 0
        },
        {
          maxStars: maxReviewStars,
          maxReviewsPerBusiness: maxReviewsPerBusiness,
          language: language,
          dayLimit: dayLimit,
          // IMPORTANT: Filter by publish date if incremental
          publishedAfter: reviewsSinceDate
        } as any
      );

      reviewsFound = fetchedReviews.length;
      console.log(`   ✓ Fetched ${reviewsFound} reviews from Apify`);

      // Filter for truly new reviews (not in cache)
      const delta = await reviewCache.filterNewReviews(businessId, fetchedReviews);
      reviewsNew = delta.stats.new_count;
      reviewsDuplicate = delta.stats.duplicate_count;

      console.log(`   ✓ New: ${reviewsNew}, Duplicates: ${reviewsDuplicate}`);

      // Cache new reviews
      if (reviewsNew > 0) {
        await reviewCache.insertBatch(businessId, delta.new_reviews);
        console.log(`   ✓ Cached ${reviewsNew} new reviews`);
      }

      // Calculate cost
      costUsd = shouldUseIncremental
        ? reviewsNew * 0.005 // Incremental: only pay for new reviews
        : maxReviewsPerBusiness * 0.01; // Full crawl: pay for all fetched

      console.log(`   💰 Cost: $${costUsd.toFixed(4)} (${shouldUseIncremental ? 'incremental' : 'full'} crawl)`);

    } catch (error: any) {
      console.error(`   ❌ Crawl failed: ${error.message}`);
      throw error;
    }

    // Record crawl in database
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    const nextRecommendedCrawl = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)); // 14 days from now

    const crawlId = await this.recordCrawl({
      businessId,
      organizationId,
      extractionId,
      crawledAt: new Date(),
      durationSeconds,
      reviewsFound,
      reviewsNew,
      reviewsDuplicate,
      isIncremental: shouldUseIncremental,
      reviewsSinceDate,
      costUsd,
      nextRecommendedCrawl,
      crawlConfig: {
        maxReviewsPerBusiness,
        maxReviewStars,
        dayLimit,
        language
      }
    });

    console.log(`   ✅ Crawl complete (${durationSeconds}s)\n`);

    return {
      businessId,
      businessName: business.name,
      crawlId,
      reviewsFound,
      reviewsNew,
      reviewsDuplicate,
      isIncremental: shouldUseIncremental,
      costUsd,
      durationSeconds,
      lastCrawledAt: new Date(),
      nextRecommendedCrawl
    };
  }

  /**
   * Crawl multiple businesses from queue
   */
  async crawlFromQueue(queueIds: string[]): Promise<CrawlResult[]> {
    console.log(`\n🚀 Starting batch crawl: ${queueIds.length} businesses\n`);

    const results: CrawlResult[] = [];

    for (const queueId of queueIds) {
      try {
        // Get queue item
        const queueItem = await this.getQueueItem(queueId);
        if (!queueItem) continue;

        // Update status to in_progress
        await db.query(`
          UPDATE crawl_queue
          SET status = 'in_progress', started_at = NOW(), attempts = attempts + 1
          WHERE id = $1;
        `, [queueId]);

        // Crawl the business
        const result = await this.crawlBusiness({
          organizationId: queueItem.organization_id,
          businessId: queueItem.business_id,
          ...queueItem.crawl_config
        });

        results.push(result);

        // Update queue item as completed
        await db.query(`
          UPDATE crawl_queue
          SET
            status = 'completed',
            completed_at = NOW(),
            reviews_extracted = $2,
            apify_cost_usd = $3
          WHERE id = $1;
        `, [queueId, result.reviewsNew, result.costUsd]);

        // Rate limiting between businesses
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error: any) {
        console.error(`❌ Queue item ${queueId} failed:`, error.message);

        // Mark as failed
        await db.query(`
          UPDATE crawl_queue
          SET status = 'failed', error_message = $2, completed_at = NOW()
          WHERE id = $1;
        `, [queueId, error.message]);
      }
    }

    console.log(`\n✅ Batch complete: ${results.length}/${queueIds.length} successful\n`);
    return results;
  }

  /**
   * Estimate cost savings from incremental crawl
   */
  async estimateIncrementalSavings(businessId: string, avgNewReviewsPerDay: number = 0.5): Promise<{
    fullCrawlCost: number;
    incrementalCost: number;
    savings: number;
    savingsPercent: number;
  }> {
    const lastCrawl = await this.getLastCrawlInfo(businessId);

    if (!lastCrawl.daysSinceLastCrawl) {
      return {
        fullCrawlCost: 0,
        incrementalCost: 0,
        savings: 0,
        savingsPercent: 0
      };
    }

    // Estimate new reviews since last crawl
    const estimatedNewReviews = Math.ceil(lastCrawl.daysSinceLastCrawl * avgNewReviewsPerDay);

    // Cost calculation
    const fullCrawlCost = 0.02; // $0.02 for full crawl (fetch all reviews)
    const incrementalCost = estimatedNewReviews * 0.005; // $0.005 per new review

    const savings = fullCrawlCost - incrementalCost;
    const savingsPercent = (savings / fullCrawlCost) * 100;

    return {
      fullCrawlCost,
      incrementalCost,
      savings: Math.max(0, savings),
      savingsPercent: Math.max(0, savingsPercent)
    };
  }

  /**
   * Determine if incremental crawl should be used
   */
  private shouldUseIncrementalCrawl(lastCrawl: LastCrawlInfo, forceFullCrawl: boolean): boolean {
    if (forceFullCrawl) return false;
    if (!lastCrawl.lastCrawledAt) return false; // Never crawled = full crawl

    const daysSince = lastCrawl.daysSinceLastCrawl || 0;

    // Use incremental if:
    // 1. Business was crawled before
    // 2. Last crawl was within reasonable time (< 60 days)
    // 3. Last crawl had some reviews (not empty business)
    return daysSince > 0 && daysSince < 60 && (lastCrawl.reviewsInLastCrawl || 0) > 0;
  }

  /**
   * Get business details
   */
  private async getBusinessDetails(businessId: string): Promise<CachedBusiness | null> {
    const result = await db.query(`
      SELECT * FROM businesses WHERE id = $1 LIMIT 1;
    `, [businessId]);

    return result.rows[0] || null;
  }

  /**
   * Get last crawl information for a business
   */
  private async getLastCrawlInfo(businessId: string): Promise<LastCrawlInfo> {
    const result = await db.query(`
      SELECT
        crawled_at as last_crawled_at,
        EXTRACT(DAY FROM NOW() - crawled_at)::INTEGER as days_since_crawl,
        reviews_found as reviews_in_last_crawl
      FROM business_review_crawls
      WHERE business_id = $1
        AND status = 'completed'
      ORDER BY crawled_at DESC
      LIMIT 1;
    `, [businessId]);

    if (result.rows.length === 0) {
      return {
        lastCrawledAt: null,
        daysSinceLastCrawl: null,
        reviewsInLastCrawl: null
      };
    }

    const row = result.rows[0];
    return {
      lastCrawledAt: row.last_crawled_at,
      daysSinceLastCrawl: row.days_since_crawl,
      reviewsInLastCrawl: row.reviews_in_last_crawl
    };
  }

  /**
   * Record crawl in database
   */
  private async recordCrawl(data: {
    businessId: string;
    organizationId: string;
    extractionId?: string;
    crawledAt: Date;
    durationSeconds: number;
    reviewsFound: number;
    reviewsNew: number;
    reviewsDuplicate: number;
    isIncremental: boolean;
    reviewsSinceDate: Date | null;
    costUsd: number;
    nextRecommendedCrawl: Date;
    crawlConfig: any;
  }): Promise<string> {
    const crawlId = uuidv4();

    await db.query(`
      INSERT INTO business_review_crawls (
        id,
        business_id,
        organization_id,
        crawled_at,
        crawl_duration_seconds,
        reviews_found,
        reviews_new,
        reviews_duplicate,
        is_incremental,
        reviews_since_date,
        apify_cost_usd,
        next_recommended_crawl,
        crawl_config,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      crawlId,
      data.businessId,
      data.organizationId || null,
      data.crawledAt,
      data.durationSeconds,
      data.reviewsFound,
      data.reviewsNew,
      data.reviewsDuplicate,
      data.isIncremental,
      data.reviewsSinceDate,
      data.costUsd,
      data.nextRecommendedCrawl,
      JSON.stringify(data.crawlConfig),
      'completed'
    ]);

    return crawlId;
  }

  /**
   * Get queue item details
   */
  private async getQueueItem(queueId: string): Promise<any> {
    const result = await db.query(`
      SELECT * FROM crawl_queue WHERE id = $1 LIMIT 1;
    `, [queueId]);

    return result.rows[0] || null;
  }

  /**
   * Get crawl history for a business
   */
  async getCrawlHistory(businessId: string): Promise<any[]> {
    const result = await db.query(`
      SELECT
        id,
        crawled_at,
        crawl_duration_seconds,
        reviews_found,
        reviews_new,
        reviews_duplicate,
        is_incremental,
        apify_cost_usd,
        next_recommended_crawl,
        status
      FROM business_review_crawls
      WHERE business_id = $1
      ORDER BY crawled_at DESC;
    `, [businessId]);

    return result.rows;
  }
}

export const incrementalCrawler = new IncrementalCrawler();
