/**
 * Cache Statistics Service
 * Provides cache performance metrics and ROI tracking
 * CRITICAL: Monitors $0.006 savings per cache hit
 */

import { query } from '../../../database/db';

export interface CacheStats {
  totalSavings: number;
  totalReuses: number;
  avgReusesPerBusiness: number;
}

export interface CacheHitRate {
  hitRate: number;
  daysAnalyzed: number;
  totalCached: number;
  totalNew: number;
  totalBusinesses: number;
  savingsUsd: number;
}

export interface CrawlCost {
  id: string;
  crawl_date: Date;
  category: string | null;
  location: string | null;
  crawl_type: string;
  new_businesses_found: number;
  cached_businesses_used: number;
  business_discovery_cost_usd: number;
  cache_savings_usd: number;
  reviews_scraped: number;
  review_cost_usd: number;
  total_cost_usd: number;
  actual_cost_usd: number;
  potential_cost_without_cache_usd: number;
  leads_generated: number | null;
  cost_per_lead_usd: number | null;
  cache_hit_rate: number;
}

export interface BusinessDueForDiscovery {
  id: string;
  place_id: string;
  name: string;
  city: string | null;
  last_discovery_crawl: Date | null;
  days_since_last_crawl: number | null;
}

export interface CustomerDueForMonitoring {
  id: string;
  place_id: string;
  name: string;
  monitoring_frequency_hours: number;
  last_review_crawl: Date | null;
  hours_since_last_crawl: number | null;
}

class CacheStatsService {
  /**
   * Get total cache savings across all businesses
   * Returns: Total USD saved, total reuses, and average reuses per business
   */
  async getTotalSavings(): Promise<CacheStats> {
    const result = await query(`
      SELECT * FROM get_total_cache_savings()
    `);

    return {
      totalSavings: parseFloat(result.rows[0].total_savings_usd) || 0,
      totalReuses: parseInt(result.rows[0].total_reuses) || 0,
      avgReusesPerBusiness: parseFloat(result.rows[0].avg_reuses_per_business) || 0
    };
  }

  /**
   * Get cache hit rate for specified time period
   * Default: Last 7 days
   * Target: >80% cache hit rate
   */
  async getCacheHitRate(daysBack: number = 7): Promise<CacheHitRate> {
    const result = await query(`
      SELECT get_cache_hit_rate($1) as hit_rate
    `, [daysBack]);

    const hitRate = parseFloat(result.rows[0].hit_rate) || 0;

    // Get detailed breakdown
    const breakdown = await query(`
      SELECT
        COALESCE(SUM(cached_businesses_used), 0) as total_cached,
        COALESCE(SUM(new_businesses_found), 0) as total_new,
        COALESCE(SUM(cache_savings_usd), 0) as savings_usd
      FROM crawl_costs
      WHERE crawl_date >= CURRENT_DATE - $1
    `, [daysBack]);

    const totalCached = parseInt(breakdown.rows[0].total_cached) || 0;
    const totalNew = parseInt(breakdown.rows[0].total_new) || 0;
    const savingsUsd = parseFloat(breakdown.rows[0].savings_usd) || 0;

    return {
      hitRate,
      daysAnalyzed: daysBack,
      totalCached,
      totalNew,
      totalBusinesses: totalCached + totalNew,
      savingsUsd
    };
  }

  /**
   * Get recent crawl cost records
   * Shows daily/weekly crawl costs and cache efficiency
   */
  async getRecentCrawlCosts(limit: number = 30): Promise<CrawlCost[]> {
    const result = await query(`
      SELECT *
      FROM crawl_costs
      ORDER BY crawl_date DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      id: row.id,
      crawl_date: new Date(row.crawl_date),
      category: row.category,
      location: row.location,
      crawl_type: row.crawl_type,
      new_businesses_found: row.new_businesses_found,
      cached_businesses_used: row.cached_businesses_used,
      business_discovery_cost_usd: parseFloat(row.business_discovery_cost_usd),
      cache_savings_usd: parseFloat(row.cache_savings_usd),
      reviews_scraped: row.reviews_scraped,
      review_cost_usd: parseFloat(row.review_cost_usd),
      total_cost_usd: parseFloat(row.total_cost_usd),
      actual_cost_usd: parseFloat(row.actual_cost_usd),
      potential_cost_without_cache_usd: parseFloat(row.potential_cost_without_cache_usd),
      leads_generated: row.leads_generated,
      cost_per_lead_usd: row.cost_per_lead_usd ? parseFloat(row.cost_per_lead_usd) : null,
      cache_hit_rate: parseFloat(row.cache_hit_rate)
    }));
  }

  /**
   * Record a crawl cost
   * Call this after each discovery or monitoring crawl
   */
  async recordCrawlCost(data: {
    category: string;
    location: string;
    crawlType: 'discovery' | 'monitoring';
    newBusinessesFound: number;
    cachedBusinessesUsed: number;
    reviewsScraped: number;
    leadsGenerated?: number;
  }): Promise<string> {
    const result = await query(`
      INSERT INTO crawl_costs (
        crawl_date, category, location, crawl_type,
        new_businesses_found, cached_businesses_used,
        reviews_scraped, leads_generated
      ) VALUES (
        CURRENT_DATE, $1, $2, $3, $4, $5, $6, $7
      )
      RETURNING id
    `, [
      data.category,
      data.location,
      data.crawlType,
      data.newBusinessesFound,
      data.cachedBusinessesUsed,
      data.reviewsScraped,
      data.leadsGenerated || 0
    ]);

    const crawlId = (result.rows[0] as { id: string }).id;
    const savings = data.cachedBusinessesUsed * 0.006;
    const cost = (data.newBusinessesFound * 0.006) + (data.reviewsScraped * 0.0005);

    console.log(`📊 Crawl cost recorded: $${cost.toFixed(2)} (saved $${savings.toFixed(2)} via cache)`);

    return crawlId;
  }

  /**
   * Get businesses due for discovery crawl (40-60 day cycle)
   */
  async getBusinessesDueForDiscovery(limit: number = 100): Promise<BusinessDueForDiscovery[]> {
    const result = await query(`
      SELECT * FROM get_businesses_due_for_discovery($1)
    `, [limit]);

    return result.rows.map(row => ({
      id: row.id,
      place_id: row.place_id,
      name: row.name,
      city: row.city,
      last_discovery_crawl: row.last_discovery_crawl ? new Date(row.last_discovery_crawl) : null,
      days_since_last_crawl: row.days_since_last_crawl
    }));
  }

  /**
   * Get paying customers due for weekly monitoring
   */
  async getCustomersDueForMonitoring(limit: number = 50): Promise<CustomerDueForMonitoring[]> {
    const result = await query(`
      SELECT * FROM get_customers_due_for_monitoring($1)
    `, [limit]);

    return result.rows.map(row => ({
      id: row.id,
      place_id: row.place_id,
      name: row.name,
      monitoring_frequency_hours: row.monitoring_frequency_hours,
      last_review_crawl: row.last_review_crawl ? new Date(row.last_review_crawl) : null,
      hours_since_last_crawl: row.hours_since_last_crawl ? parseFloat(row.hours_since_last_crawl) : null
    }));
  }

  /**
   * Check if cache hit rate is below target (80%)
   * Returns alert message if below threshold
   */
  async checkCacheHealth(daysBack: number = 7): Promise<{
    healthy: boolean;
    hitRate: number;
    message: string;
    recommendation?: string;
  }> {
    const stats = await this.getCacheHitRate(daysBack);
    const TARGET_HIT_RATE = 80;

    if (stats.hitRate >= TARGET_HIT_RATE) {
      return {
        healthy: true,
        hitRate: stats.hitRate,
        message: `✅ Cache performance healthy: ${stats.hitRate.toFixed(1)}% hit rate (target: >${TARGET_HIT_RATE}%)`
      };
    }

    const deficit = TARGET_HIT_RATE - stats.hitRate;
    const potentialSavings = (stats.totalNew * deficit / 100) * 0.006;

    return {
      healthy: false,
      hitRate: stats.hitRate,
      message: `⚠️ Cache hit rate below target: ${stats.hitRate.toFixed(1)}% (target: >${TARGET_HIT_RATE}%)`,
      recommendation: `Increasing cache hit rate by ${deficit.toFixed(1)}% could save an additional $${potentialSavings.toFixed(2)} per period. Consider focusing on existing business categories/locations.`
    };
  }

  /**
   * Get top performing categories/locations by cache hit rate
   */
  async getTopPerformingSegments(limit: number = 10): Promise<{
    category: string | null;
    location: string | null;
    cached: number;
    new: number;
    hitRate: number;
    savings: number;
  }[]> {
    const result = await query(`
      SELECT
        category,
        location,
        SUM(cached_businesses_used) as cached,
        SUM(new_businesses_found) as new,
        CASE
          WHEN (SUM(cached_businesses_used) + SUM(new_businesses_found)) > 0
          THEN (SUM(cached_businesses_used)::DECIMAL / (SUM(cached_businesses_used) + SUM(new_businesses_found)) * 100)
          ELSE 0
        END as hit_rate,
        SUM(cache_savings_usd) as savings
      FROM crawl_costs
      GROUP BY category, location
      HAVING (SUM(cached_businesses_used) + SUM(new_businesses_found)) > 0
      ORDER BY hit_rate DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      category: row.category,
      location: row.location,
      cached: parseInt(row.cached),
      new: parseInt(row.new),
      hitRate: parseFloat(row.hit_rate),
      savings: parseFloat(row.savings)
    }));
  }

  /**
   * Get cache summary for dashboard display
   */
  async getDashboardSummary(): Promise<{
    totalSavings: number;
    last7Days: CacheHitRate;
    last30Days: CacheHitRate;
    health: {
      healthy: boolean;
      hitRate: number;
      message: string;
      recommendation?: string;
    };
    topSegments: {
      category: string | null;
      location: string | null;
      cached: number;
      new: number;
      hitRate: number;
      savings: number;
    }[];
  }> {
    const [totalSavings, last7Days, last30Days, health, topSegments] = await Promise.all([
      this.getTotalSavings(),
      this.getCacheHitRate(7),
      this.getCacheHitRate(30),
      this.checkCacheHealth(7),
      this.getTopPerformingSegments(5)
    ]);

    return {
      totalSavings: totalSavings.totalSavings,
      last7Days,
      last30Days,
      health,
      topSegments
    };
  }
}

export const cacheStats = new CacheStatsService();
