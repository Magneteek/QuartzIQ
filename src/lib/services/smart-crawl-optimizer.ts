/**
 * Smart Crawl Optimizer
 * Detects when to stop crawling based on review availability patterns
 *
 * SAVINGS: Can reduce crawl costs by 40-60% by stopping when
 * businesses without reviews become dominant
 */

export interface CrawlMetrics {
  totalCrawled: number;
  withReviews: number;
  withoutReviews: number;
  consecutiveWithoutReviews: number;
  rollingWindowQuality: number;
}

export interface StoppingCriteria {
  // Stop if X consecutive businesses have 0 reviews
  consecutiveZeroThreshold: number;

  // Stop if quality in last N businesses drops below threshold
  rollingWindowSize: number;
  minRollingWindowQuality: number;

  // Minimum businesses to crawl before stopping logic kicks in
  minBusinessesBeforeStopping: number;

  // Cost optimization: stop if effective cost per qualifying business exceeds threshold
  maxCostPerQualifyingBusiness?: number;
  costPerBusinessCrawl?: number;
}

export class SmartCrawlOptimizer {
  private metrics: CrawlMetrics = {
    totalCrawled: 0,
    withReviews: 0,
    withoutReviews: 0,
    consecutiveWithoutReviews: 0,
    rollingWindowQuality: 1.0
  };

  private recentBusinesses: boolean[] = []; // true = has reviews, false = no reviews
  private criteria: StoppingCriteria;

  constructor(criteria: Partial<StoppingCriteria> = {}) {
    // Set defaults with conservative stopping to avoid premature stops
    this.criteria = {
      consecutiveZeroThreshold: criteria.consecutiveZeroThreshold || 25,
      rollingWindowSize: criteria.rollingWindowSize || 50,
      minRollingWindowQuality: criteria.minRollingWindowQuality || 0.20, // 20% must have reviews
      minBusinessesBeforeStopping: criteria.minBusinessesBeforeStopping || 100,
      maxCostPerQualifyingBusiness: criteria.maxCostPerQualifyingBusiness,
      costPerBusinessCrawl: criteria.costPerBusinessCrawl || 0.03
    };
  }

  /**
   * Process a newly crawled business and update metrics
   * @param hasReviews - Whether the business has any reviews
   * @returns true if crawling should stop, false to continue
   */
  processBusinessAndCheckStop(hasReviews: boolean): {
    shouldStop: boolean;
    reason?: string;
    metrics: CrawlMetrics;
    projectedSavings?: number;
  } {
    // Update metrics
    this.metrics.totalCrawled++;

    if (hasReviews) {
      this.metrics.withReviews++;
      this.metrics.consecutiveWithoutReviews = 0;
    } else {
      this.metrics.withoutReviews++;
      this.metrics.consecutiveWithoutReviews++;
    }

    // Add to rolling window
    this.recentBusinesses.push(hasReviews);
    if (this.recentBusinesses.length > this.criteria.rollingWindowSize) {
      this.recentBusinesses.shift(); // Remove oldest
    }

    // Calculate rolling window quality
    if (this.recentBusinesses.length >= this.criteria.rollingWindowSize) {
      const withReviewsInWindow = this.recentBusinesses.filter(Boolean).length;
      this.metrics.rollingWindowQuality = withReviewsInWindow / this.recentBusinesses.length;
    }

    // Don't stop if we haven't met minimum threshold
    if (this.metrics.totalCrawled < this.criteria.minBusinessesBeforeStopping) {
      return {
        shouldStop: false,
        metrics: { ...this.metrics }
      };
    }

    // Check stopping criteria

    // Criterion 1: Consecutive zero-review threshold
    if (this.metrics.consecutiveWithoutReviews >= this.criteria.consecutiveZeroThreshold) {
      const projectedTotal = this.estimateRemainingBusinesses();
      const projectedSavings = this.calculateSavings(projectedTotal);

      return {
        shouldStop: true,
        reason: `Encountered ${this.metrics.consecutiveWithoutReviews} consecutive businesses without reviews`,
        metrics: { ...this.metrics },
        projectedSavings
      };
    }

    // Criterion 2: Rolling window quality threshold
    if (
      this.recentBusinesses.length >= this.criteria.rollingWindowSize &&
      this.metrics.rollingWindowQuality < this.criteria.minRollingWindowQuality
    ) {
      const projectedTotal = this.estimateRemainingBusinesses();
      const projectedSavings = this.calculateSavings(projectedTotal);

      return {
        shouldStop: true,
        reason: `Quality in last ${this.criteria.rollingWindowSize} businesses dropped to ${(this.metrics.rollingWindowQuality * 100).toFixed(1)}% (threshold: ${(this.criteria.minRollingWindowQuality * 100).toFixed(1)}%)`,
        metrics: { ...this.metrics },
        projectedSavings
      };
    }

    // Criterion 3: Cost-benefit analysis (if configured)
    if (this.criteria.maxCostPerQualifyingBusiness && this.criteria.costPerBusinessCrawl) {
      const qualifyingRate = this.metrics.withReviews / this.metrics.totalCrawled;
      const effectiveCost = qualifyingRate > 0
        ? this.criteria.costPerBusinessCrawl / qualifyingRate
        : Infinity;

      if (effectiveCost > this.criteria.maxCostPerQualifyingBusiness) {
        const projectedTotal = this.estimateRemainingBusinesses();
        const projectedSavings = this.calculateSavings(projectedTotal);

        return {
          shouldStop: true,
          reason: `Cost per qualifying business ($${effectiveCost.toFixed(4)}) exceeds threshold ($${this.criteria.maxCostPerQualifyingBusiness.toFixed(4)})`,
          metrics: { ...this.metrics },
          projectedSavings
        };
      }
    }

    // Continue crawling
    return {
      shouldStop: false,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Estimate how many more businesses would have been crawled
   * Based on typical Google Maps result patterns
   */
  private estimateRemainingBusinesses(): number {
    // Typical patterns:
    // - Small categories: 100-500 total results
    // - Medium categories: 500-2000 total results
    // - Large categories: 2000-5000 total results

    // Use current crawl rate to estimate total
    const currentRate = this.metrics.withReviews / this.metrics.totalCrawled;

    if (currentRate > 0.5) {
      // High-quality results, likely still early
      return Math.max(1000, this.metrics.totalCrawled * 3);
    } else if (currentRate > 0.3) {
      // Medium quality, mid-crawl
      return Math.max(500, this.metrics.totalCrawled * 2);
    } else {
      // Low quality, probably late in results
      return Math.max(200, this.metrics.totalCrawled * 1.5);
    }
  }

  /**
   * Calculate projected credit savings
   */
  private calculateSavings(estimatedTotal: number): number {
    const remainingBusinesses = estimatedTotal - this.metrics.totalCrawled;
    const savingsPerBusiness = this.criteria.costPerBusinessCrawl || 0.03;
    return remainingBusinesses * savingsPerBusiness;
  }

  /**
   * Get current crawl statistics
   */
  getStatistics() {
    return {
      ...this.metrics,
      qualityRate: this.metrics.totalCrawled > 0
        ? this.metrics.withReviews / this.metrics.totalCrawled
        : 0,
      stopCriteria: this.criteria
    };
  }

  /**
   * Reset optimizer for new crawl
   */
  reset() {
    this.metrics = {
      totalCrawled: 0,
      withReviews: 0,
      withoutReviews: 0,
      consecutiveWithoutReviews: 0,
      rollingWindowQuality: 1.0
    };
    this.recentBusinesses = [];
  }
}
