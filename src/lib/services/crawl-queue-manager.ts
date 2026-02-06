/**
 * Crawl Queue Manager
 * Manages batch crawl queue, prioritization, and execution
 */

import { db } from '../../../database/db';
import { v4 as uuidv4 } from 'uuid';

export interface QueueBusinessOptions {
  organizationId: string;
  businessIds: string[];
  batchName?: string;
  priority?: number;
  scheduledFor?: Date;
  crawlConfig?: CrawlConfig;
}

export interface CrawlConfig {
  maxReviewsPerBusiness?: number;
  maxReviewStars?: number;
  dayLimit?: number;
  incremental?: boolean;
  language?: string;
}

export interface BatchInfo {
  batchId: string;
  batchName: string;
  businessCount: number;
  estimatedCost: number;
  estimatedDuration: string;
  queuedAt: Date;
}

export interface QueueStatus {
  batches: {
    batchId: string;
    batchName: string;
    organizationId: string;
    businessCount: number;
    status: string;
    progress: number;
    completed: number;
    failed: number;
    queued: number;
    inProgress: number;
    totalReviews: number;
    totalCost: number;
    queuedAt: Date;
    scheduledFor?: Date;
  }[];
  stats: {
    totalQueued: number;
    totalInProgress: number;
    estimatedTotalCost: number;
  };
}

export interface BusinessCrawlStatus {
  id: string;
  placeId: string;
  name: string;
  city: string;
  category: string;
  rating: number;
  reviewsCount: number;
  lastCrawledAt: Date | null;
  daysSinceLastCrawl: number | null;
  crawlStatus: 'never_crawled' | 'overdue' | 'due' | 'soon' | 'recent';
  inQueue: boolean;
  nextRecommendedCrawl: Date | null;
  reviewsInLastCrawl: number | null;
}

class CrawlQueueManager {
  /**
   * Add businesses to crawl queue
   */
  async addToQueue(options: QueueBusinessOptions): Promise<BatchInfo> {
    const {
      organizationId,
      businessIds,
      batchName = `Batch ${new Date().toISOString().slice(0, 10)}`,
      priority = 50,
      scheduledFor,
      crawlConfig = {}
    } = options;

    if (!businessIds || businessIds.length === 0) {
      throw new Error('No businesses provided');
    }

    const batchId = uuidv4();
    const queuedAt = new Date();

    console.log(`\n📋 Adding ${businessIds.length} businesses to queue`);
    console.log(`   Batch: ${batchName} (${batchId})`);
    console.log(`   Priority: ${priority}`);

    // Insert all businesses into queue
    const values = businessIds.map((businessId, index) => {
      return `(
        '${uuidv4()}',
        '${organizationId}',
        '${businessId}',
        '${batchName.replace(/'/g, "''")}',
        '${batchId}',
        ${priority},
        ${index + 1},
        ${scheduledFor ? `'${scheduledFor.toISOString()}'` : 'NULL'},
        '${JSON.stringify(crawlConfig).replace(/'/g, "''")}'
      )`;
    }).join(',\n      ');

    const query = `
      INSERT INTO crawl_queue (
        id,
        organization_id,
        business_id,
        batch_name,
        batch_id,
        priority,
        position_in_batch,
        scheduled_for,
        crawl_config
      ) VALUES
      ${values}
      ON CONFLICT (business_id, status) WHERE status IN ('queued', 'in_progress')
      DO NOTHING
      RETURNING id;
    `;

    const result = await db.query(query);
    const insertedCount = result.rows.length;

    console.log(`   ✅ Queued: ${insertedCount} businesses`);

    if (insertedCount < businessIds.length) {
      console.log(`   ⚠️  Skipped: ${businessIds.length - insertedCount} (already in queue)`);
    }

    // Calculate estimates
    const avgReviewsPerBusiness = crawlConfig.maxReviewsPerBusiness || 2;
    const costPerBusiness = 0.02; // Average Apify cost
    const estimatedCost = insertedCount * costPerBusiness;
    const estimatedSeconds = insertedCount * 3; // ~3 seconds per business
    const estimatedDuration = estimatedSeconds > 60
      ? `${Math.round(estimatedSeconds / 60)} minutes`
      : `${estimatedSeconds} seconds`;

    return {
      batchId,
      batchName,
      businessCount: insertedCount,
      estimatedCost,
      estimatedDuration,
      queuedAt
    };
  }

  /**
   * Get current queue status with batch progress
   */
  async getQueueStatus(organizationId?: string): Promise<QueueStatus> {
    let whereClause = '';
    const params: any[] = [];

    if (organizationId) {
      whereClause = 'WHERE organization_id = $1';
      params.push(organizationId);
    }

    const query = `
      SELECT
        batch_id,
        batch_name,
        organization_id,
        MIN(queued_at) as queued_at,
        MIN(scheduled_for) as scheduled_for,
        COUNT(*)::INTEGER as business_count,
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as completed,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as failed,
        COUNT(*) FILTER (WHERE status = 'queued')::INTEGER as queued,
        COUNT(*) FILTER (WHERE status = 'in_progress')::INTEGER as in_progress,
        COALESCE(SUM(reviews_extracted), 0)::INTEGER as total_reviews,
        COALESCE(SUM(apify_cost_usd), 0)::DECIMAL as total_cost,
        CASE
          WHEN COUNT(*) > 0 THEN
            ROUND((COUNT(*) FILTER (WHERE status IN ('completed', 'failed'))::DECIMAL / COUNT(*)) * 100, 1)
          ELSE 0
        END as progress
      FROM crawl_queue
      ${whereClause}
      GROUP BY batch_id, batch_name, organization_id
      ORDER BY MIN(queued_at) DESC;
    `;

    const result = await db.query(query, params);

    const batches = result.rows.map((row: any) => ({
      batchId: row.batch_id,
      batchName: row.batch_name,
      organizationId: row.organization_id,
      businessCount: row.business_count,
      status: this.determineBatchStatus(row),
      progress: parseFloat(row.progress),
      completed: row.completed,
      failed: row.failed,
      queued: row.queued,
      inProgress: row.in_progress,
      totalReviews: row.total_reviews,
      totalCost: parseFloat(row.total_cost),
      queuedAt: row.queued_at,
      scheduledFor: row.scheduled_for
    }));

    // Calculate overall stats
    const stats = {
      totalQueued: batches.reduce((sum: number, b: any) => sum + b.queued, 0),
      totalInProgress: batches.reduce((sum: number, b: any) => sum + b.inProgress, 0),
      estimatedTotalCost: batches
        .filter((b: any) => b.status === 'queued')
        .reduce((sum: number, b: any) => sum + (b.businessCount * 0.02), 0)
    };

    return { batches, stats };
  }

  /**
   * Get businesses with their crawl status
   */
  async getBusinessesWithCrawlStatus(options: {
    organizationId?: string;
    category?: string;
    city?: string;
    crawlStatus?: 'never_crawled' | 'overdue' | 'due' | 'soon' | 'recent';
    inQueue?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: 'lastCrawled' | 'rating' | 'name' | 'reviewCount';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ businesses: BusinessCrawlStatus[]; total: number }> {
    const {
      category,
      city,
      crawlStatus,
      inQueue,
      limit = 50,
      offset = 0,
      sortBy = 'lastCrawled',
      sortOrder = 'asc'
    } = options;

    // Build WHERE clauses
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`category ILIKE $${paramIndex}`);
      params.push(`%${category}%`);
      paramIndex++;
    }

    if (city) {
      conditions.push(`city ILIKE $${paramIndex}`);
      params.push(`%${city}%`);
      paramIndex++;
    }

    if (crawlStatus) {
      conditions.push(`crawl_status = $${paramIndex}`);
      params.push(crawlStatus);
      paramIndex++;
    }

    if (inQueue !== undefined) {
      conditions.push(`in_queue = $${paramIndex}`);
      params.push(inQueue);
      paramIndex++;
    }

    // Build ORDER BY clause
    const sortMapping: Record<string, string> = {
      lastCrawled: 'last_crawled_at',
      rating: 'rating',
      name: 'name',
      reviewCount: 'reviews_count'
    };

    const sortColumn = sortMapping[sortBy] || 'last_crawled_at';
    const orderBy = `ORDER BY ${sortColumn} ${sortOrder.toUpperCase()} NULLS LAST`;

    // Query
    const query = `
      SELECT
        id,
        place_id,
        name,
        city,
        category,
        rating,
        reviews_count,
        last_crawled_at,
        days_since_crawl,
        crawl_status,
        in_queue,
        next_recommended,
        reviews_in_last_crawl
      FROM businesses_with_crawl_status
      WHERE ${conditions.join(' AND ')}
      ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM businesses_with_crawl_status
      WHERE ${conditions.join(' AND ')};
    `;

    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    const businesses = result.rows.map((row: any) => ({
      id: row.id,
      placeId: row.place_id,
      name: row.name,
      city: row.city,
      category: row.category,
      rating: parseFloat(row.rating) || 0,
      reviewsCount: row.reviews_count || 0,
      lastCrawledAt: row.last_crawled_at,
      daysSinceLastCrawl: row.days_since_crawl,
      crawlStatus: row.crawl_status,
      inQueue: row.in_queue,
      nextRecommendedCrawl: row.next_recommended,
      reviewsInLastCrawl: row.reviews_in_last_crawl
    }));

    return { businesses, total };
  }

  /**
   * Start executing queued crawls for a batch
   */
  async startBatch(batchId: string): Promise<void> {
    console.log(`\n🚀 Starting batch execution: ${batchId}`);

    // Mark batch as in_progress
    await db.query(`
      UPDATE crawl_queue
      SET status = 'in_progress', started_at = NOW()
      WHERE batch_id = $1 AND status = 'queued';
    `, [batchId]);

    console.log('   ✓ Batch marked as in-progress');
    console.log('   Note: Actual crawl execution happens in background worker');
  }

  /**
   * Cancel a batch
   */
  async cancelBatch(batchId: string): Promise<void> {
    await db.query(`
      UPDATE crawl_queue
      SET status = 'cancelled'
      WHERE batch_id = $1 AND status IN ('queued', 'in_progress');
    `, [batchId]);
  }

  /**
   * Calculate priority score for businesses
   */
  async calculatePriorities(): Promise<void> {
    // Update priority scores based on:
    // - Days since last crawl (more urgent)
    // - Business rating (lower = more urgent)
    // - Review count (higher volume = more urgent)

    await db.query(`
      UPDATE crawl_queue cq
      SET priority = (
        -- Days since crawl (0-50 points)
        LEAST(COALESCE(EXTRACT(DAY FROM NOW() - b.last_crawled_at)::INTEGER, 30) * 2, 50) +
        -- Business rating (0-30 points, lower rating = higher priority)
        ((5 - COALESCE(b.rating, 3)) * 6) +
        -- Review frequency (0-20 points)
        LEAST(COALESCE(b.reviews_count / 10, 0), 20)
      )::INTEGER
      FROM businesses_with_crawl_status b
      WHERE cq.business_id = b.id
        AND cq.status = 'queued';
    `);

    console.log('✓ Priorities recalculated');
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(organizationId?: string): Promise<any> {
    let whereClause = '';
    const params: any[] = [];

    if (organizationId) {
      whereClause = 'AND organization_id = $1';
      params.push(organizationId);
    }

    const result = await db.query(`
      WITH stats AS (
        SELECT
          COUNT(*) FILTER (WHERE crawl_status = 'never_crawled') as never_crawled,
          COUNT(*) FILTER (WHERE crawl_status IN ('due', 'overdue')) as due_for_recrawl,
          COUNT(*) FILTER (WHERE crawl_status IN ('recent', 'soon')) as up_to_date,
          COUNT(*) FILTER (WHERE in_queue = TRUE) as in_queue,
          COUNT(*) as total
        FROM businesses_with_crawl_status
        WHERE 1=1 ${whereClause}
      ),
      cost_stats AS (
        SELECT
          COALESCE(SUM(apify_cost_usd), 0) as total_spent,
          COALESCE(AVG(apify_cost_usd), 0) as avg_cost_per_crawl,
          COUNT(*) as total_crawls
        FROM business_review_crawls
        WHERE status = 'completed' ${whereClause}
      )
      SELECT * FROM stats, cost_stats;
    `, params);

    const row = result.rows[0];

    return {
      totalBusinesses: parseInt(row.total),
      crawlStatus: {
        neverCrawled: parseInt(row.never_crawled),
        dueForRecrawl: parseInt(row.due_for_recrawl),
        upToDate: parseInt(row.up_to_date),
        inQueue: parseInt(row.in_queue)
      },
      costAnalysis: {
        totalSpent: parseFloat(row.total_spent),
        avgCostPerBusiness: parseFloat(row.avg_cost_per_crawl),
        totalCrawls: parseInt(row.total_crawls)
      }
    };
  }

  /**
   * Helper: Determine batch status
   */
  private determineBatchStatus(row: any): string {
    if (row.in_progress > 0) return 'in_progress';
    if (row.queued > 0 && row.in_progress === 0) return 'queued';
    if (row.completed === row.business_count) return 'completed';
    if (row.failed > 0 && row.queued === 0 && row.in_progress === 0) return 'failed';
    return 'mixed';
  }
}

export const crawlQueueManager = new CrawlQueueManager();
