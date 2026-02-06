/**
 * Review Momentum Analyzer
 * Analyzes review velocity and trends for businesses
 * Helps identify trending, declining, or stable businesses
 */

import { db, query } from '../../../database/db';
import { ReviewMomentumData, BusinessWithMomentum } from '../types/universal-search';
import { logger } from '../logger';

const momentumLogger = logger.child({ module: 'review-momentum' });

export class ReviewMomentumAnalyzer {
  /**
   * Calculate review momentum for a single business
   */
  async analyzeMomentum(
    businessId: string,
    periodDays: number = 30
  ): Promise<ReviewMomentumData | null> {
    try {
      // Get business info
      const businessResult = await query(`
        SELECT id, name
        FROM businesses
        WHERE id = $1
      `, [businessId]);

      if (businessResult.rows.length === 0) {
        momentumLogger.warn('Business not found for momentum analysis', { businessId });
        return null;
      }

      const business = businessResult.rows[0];

      // Get reviews with dates and ratings
      const reviewsResult = await query(`
        SELECT published_date, rating
        FROM reviews
        WHERE business_id = $1
        ORDER BY published_date DESC
      `, [businessId]);

      const allReviews = reviewsResult.rows;

      if (allReviews.length === 0) {
        momentumLogger.debug('No reviews found for business', { businessId, businessName: business.name });
        return null;
      }

      const now = new Date();
      const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
      const previousPeriodStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);

      // Reviews in current period
      const currentPeriodReviews = allReviews.filter(r =>
        new Date(r.published_date) >= periodStart
      );

      // Reviews in previous period (for comparison)
      const previousPeriodReviews = allReviews.filter(r =>
        new Date(r.published_date) >= previousPeriodStart &&
        new Date(r.published_date) < periodStart
      );

      // Calculate velocity (reviews per day)
      const reviewVelocity = Number((currentPeriodReviews.length / periodDays).toFixed(2));

      // Calculate percent change
      const percentChange = previousPeriodReviews.length > 0
        ? Number((((currentPeriodReviews.length - previousPeriodReviews.length) / previousPeriodReviews.length) * 100).toFixed(2))
        : currentPeriodReviews.length > 0 ? 100 : 0;

      // Determine trend
      let trend: 'increasing' | 'decreasing' | 'stable' | 'spike';
      if (percentChange > 200) {
        trend = 'spike'; // Massive increase (300%+)
      } else if (percentChange > 50) {
        trend = 'increasing'; // Significant growth (50%+)
      } else if (percentChange < -50) {
        trend = 'decreasing'; // Significant decline (-50%+)
      } else {
        trend = 'stable'; // Within ±50%
      }

      // Calculate rating trends
      const currentAvgRating = currentPeriodReviews.length > 0
        ? Number((currentPeriodReviews.reduce((sum, r) => sum + Number(r.rating), 0) / currentPeriodReviews.length).toFixed(2))
        : 0;

      const previousAvgRating = previousPeriodReviews.length > 0
        ? Number((previousPeriodReviews.reduce((sum, r) => sum + Number(r.rating), 0) / previousPeriodReviews.length).toFixed(2))
        : 0;

      const ratingTrend = currentAvgRating > previousAvgRating + 0.2 ? 'improving'
        : currentAvgRating < previousAvgRating - 0.2 ? 'declining'
        : 'stable';

      const momentumData: ReviewMomentumData = {
        businessId,
        businessName: business.name,
        totalReviews: allReviews.length,
        reviewsInPeriod: currentPeriodReviews.length,
        reviewVelocity,
        trend,
        currentPeriodReviews: currentPeriodReviews.length,
        previousPeriodReviews: previousPeriodReviews.length,
        percentChange,
        avgRatingInPeriod: currentAvgRating,
        ratingTrend,
      };

      // Cache the momentum data in database
      await this.cacheMomentum(businessId, periodDays, momentumData);

      return momentumData;
    } catch (error) {
      momentumLogger.error('Error analyzing momentum', {
        error: error instanceof Error ? error.message : String(error),
        businessId,
        periodDays,
      });
      return null;
    }
  }

  /**
   * Cache momentum data in database for performance
   */
  private async cacheMomentum(
    businessId: string,
    periodDays: number,
    data: ReviewMomentumData
  ): Promise<void> {
    try {
      await query(`
        INSERT INTO business_review_momentum (
          business_id,
          analysis_period_days,
          analysis_date,
          total_reviews,
          reviews_in_period,
          reviews_in_previous_period,
          review_velocity,
          percent_change,
          trend,
          avg_rating_in_period,
          rating_trend
        ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (business_id, analysis_period_days, analysis_date)
        DO UPDATE SET
          total_reviews = EXCLUDED.total_reviews,
          reviews_in_period = EXCLUDED.reviews_in_period,
          reviews_in_previous_period = EXCLUDED.reviews_in_previous_period,
          review_velocity = EXCLUDED.review_velocity,
          percent_change = EXCLUDED.percent_change,
          trend = EXCLUDED.trend,
          avg_rating_in_period = EXCLUDED.avg_rating_in_period,
          rating_trend = EXCLUDED.rating_trend,
          updated_at = NOW()
      `, [
        businessId,
        periodDays,
        data.totalReviews,
        data.reviewsInPeriod,
        data.previousPeriodReviews,
        data.reviewVelocity,
        data.percentChange,
        data.trend,
        data.avgRatingInPeriod,
        data.ratingTrend,
      ]);
    } catch (error) {
      // Don't fail the main operation if caching fails
      momentumLogger.warn('Failed to cache momentum data', {
        error: error instanceof Error ? error.message : String(error),
        businessId,
      });
    }
  }

  /**
   * Filter businesses by momentum criteria
   */
  async filterByMomentum(
    businesses: BusinessWithMomentum[],
    criteria: {
      enabled: boolean;
      period: number;
      minReviewsInPeriod: number;
      type: 'growing' | 'declining' | 'stable' | 'spike' | 'any';
    }
  ): Promise<BusinessWithMomentum[]> {
    if (!criteria.enabled) {
      return businesses;
    }

    momentumLogger.info('Filtering businesses by momentum', {
      totalBusinesses: businesses.length,
      period: criteria.period,
      minReviews: criteria.minReviewsInPeriod,
      type: criteria.type,
    });

    const results: BusinessWithMomentum[] = [];

    for (const business of businesses) {
      // Analyze momentum for this business
      const momentum = await this.analyzeMomentum(
        business.id!,
        criteria.period
      );

      if (!momentum) {
        continue; // Skip businesses without reviews
      }

      // Check if meets momentum criteria
      const meetsReviewCount = momentum.reviewsInPeriod >= criteria.minReviewsInPeriod;
      const meetsTrend = criteria.type === 'any' || this.matchesTrendType(momentum.trend, criteria.type);

      if (meetsReviewCount && meetsTrend) {
        results.push({
          ...business,
          momentum, // Attach momentum data to business
        });
      }
    }

    momentumLogger.info('Momentum filtering complete', {
      originalCount: businesses.length,
      filteredCount: results.length,
      removedCount: businesses.length - results.length,
    });

    return results;
  }

  /**
   * Check if trend matches criteria
   */
  private matchesTrendType(
    trend: 'increasing' | 'decreasing' | 'stable' | 'spike',
    criteriaType: 'growing' | 'declining' | 'stable' | 'spike' | 'any'
  ): boolean {
    if (criteriaType === 'any') return true;

    // Map criteria to trend types
    const mapping: Record<string, string[]> = {
      growing: ['increasing', 'spike'],
      declining: ['decreasing'],
      stable: ['stable'],
      spike: ['spike'],
    };

    return mapping[criteriaType]?.includes(trend) || false;
  }

  /**
   * Get cached momentum data (faster than recalculating)
   */
  async getCachedMomentum(
    businessId: string,
    periodDays: number = 30,
    maxAgeHours: number = 24
  ): Promise<ReviewMomentumData | null> {
    try {
      const result = await query(`
        SELECT
          business_id,
          total_reviews,
          reviews_in_period,
          reviews_in_previous_period,
          review_velocity,
          percent_change,
          trend,
          avg_rating_in_period,
          rating_trend
        FROM business_review_momentum
        WHERE business_id = $1
          AND analysis_period_days = $2
          AND analysis_date >= NOW() - INTERVAL '${maxAgeHours} hours'
        ORDER BY analysis_date DESC
        LIMIT 1
      `, [businessId, periodDays]);

      if (result.rows.length === 0) {
        return null; // No cached data or too old
      }

      const row = result.rows[0];

      // Get business name
      const businessResult = await query(`
        SELECT name FROM businesses WHERE id = $1
      `, [businessId]);

      return {
        businessId: row.business_id,
        businessName: businessResult.rows[0]?.name || 'Unknown',
        totalReviews: Number(row.total_reviews),
        reviewsInPeriod: Number(row.reviews_in_period),
        reviewVelocity: Number(row.review_velocity),
        trend: row.trend,
        currentPeriodReviews: Number(row.reviews_in_period),
        previousPeriodReviews: Number(row.reviews_in_previous_period),
        percentChange: Number(row.percent_change),
        avgRatingInPeriod: Number(row.avg_rating_in_period),
        ratingTrend: row.rating_trend,
      };
    } catch (error) {
      momentumLogger.error('Error getting cached momentum', {
        error: error instanceof Error ? error.message : String(error),
        businessId,
      });
      return null;
    }
  }

  /**
   * Get momentum statistics across multiple businesses
   */
  async getMomentumStats(businessIds: string[], periodDays: number = 30): Promise<{
    businessesAnalyzed: number;
    businessesWithReviews: number;
    avgReviewVelocity: number;
    trendDistribution: {
      increasing: number;
      decreasing: number;
      stable: number;
      spike: number;
    };
  }> {
    const trendCounts = {
      increasing: 0,
      decreasing: 0,
      stable: 0,
      spike: 0,
    };

    let totalVelocity = 0;
    let businessesWithReviews = 0;

    for (const businessId of businessIds) {
      const momentum = await this.analyzeMomentum(businessId, periodDays);
      if (momentum) {
        businessesWithReviews++;
        totalVelocity += momentum.reviewVelocity;
        trendCounts[momentum.trend]++;
      }
    }

    return {
      businessesAnalyzed: businessIds.length,
      businessesWithReviews,
      avgReviewVelocity: businessesWithReviews > 0
        ? Number((totalVelocity / businessesWithReviews).toFixed(2))
        : 0,
      trendDistribution: trendCounts,
    };
  }
}

// Export singleton instance
export const reviewMomentumAnalyzer = new ReviewMomentumAnalyzer();
