/**
 * Review Cache Service
 * Handles review deduplication and incremental updates
 * COST SAVINGS: Only fetch new reviews, not entire history
 */

import { db, query, transaction } from '../../../database/db';
import { PoolClient } from 'pg';
import crypto from 'crypto';

export interface CachedReview {
  id: string;
  business_id: string;
  review_id: string | null;
  reviewer_name: string | null;
  rating: number;
  text: string | null;
  published_date: Date;
  extracted_at: Date;
  sentiment_score: number | null;
  sentiment_label: string | null;
  complaint_category: string | null;
  severity_score: number | null;
  urgency_level: string | null;
  owner_response: string | null;
  owner_response_date: Date | null;
  raw_data: any;
}

export interface ReviewDelta {
  new_reviews: any[]; // Reviews not in cache
  existing_reviews: string[]; // Review hashes already in cache
  stats: {
    total_fetched: number;
    new_count: number;
    duplicate_count: number;
    deduplication_rate: number;
  };
}

class ReviewCacheService {
  /**
   * Generate review hash for deduplication
   * Uses reviewer name + text + date
   */
  private generateReviewHash(
    reviewerName: string | null,
    text: string | null,
    publishedDate: Date
  ): string {
    const content = `${reviewerName || 'anonymous'}|${text || ''}|${publishedDate.toISOString().split('T')[0]}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Check which reviews are new (not in cache)
   * CRITICAL: Prevents re-processing same reviews
   */
  async filterNewReviews(businessId: string, reviews: any[]): Promise<ReviewDelta> {
    if (reviews.length === 0) {
      return {
        new_reviews: [],
        existing_reviews: [],
        stats: {
          total_fetched: 0,
          new_count: 0,
          duplicate_count: 0,
          deduplication_rate: 0
        }
      };
    }

    // Generate hashes for all reviews
    const reviewHashes = reviews.map(r =>
      this.generateReviewHash(
        r.reviewerName || r.reviewer_name,
        r.text || r.reviewText,
        new Date(r.publishedAtDate || r.published_date || r.date)
      )
    );

    // Check which hashes exist in database
    const result = await query(`
      SELECT review_hash
      FROM reviews
      WHERE business_id = $1 AND review_hash = ANY($2::varchar[])
    `, [businessId, reviewHashes]);

    const existingHashes = new Set(result.rows.map(r => r.review_hash));

    // Filter out existing reviews
    const newReviews = reviews.filter((review, index) => {
      const hash = reviewHashes[index];
      return !existingHashes.has(hash);
    });

    const stats = {
      total_fetched: reviews.length,
      new_count: newReviews.length,
      duplicate_count: reviews.length - newReviews.length,
      deduplication_rate: (reviews.length - newReviews.length) / reviews.length
    };

    console.log(`🔍 Review deduplication: ${stats.new_count} new / ${stats.duplicate_count} duplicates (${(stats.deduplication_rate * 100).toFixed(1)}% filtered)`);

    if (stats.duplicate_count > 0) {
      console.log(`💰 Saved processing ${stats.duplicate_count} duplicate reviews`);
    }

    return {
      new_reviews: newReviews,
      existing_reviews: Array.from(existingHashes),
      stats
    };
  }

  /**
   * Insert new review
   */
  async insert(businessId: string, review: {
    review_id?: string;
    reviewer_name?: string;
    rating: number;
    text?: string;
    published_date: Date;
    sentiment_score?: number;
    sentiment_label?: string;
    complaint_category?: string;
    severity_score?: number;
    urgency_level?: string;
    owner_response?: string;
    owner_response_date?: Date;
    source?: string;
    language?: string;
    raw_data?: any;
  }): Promise<string> {
    const reviewHash = this.generateReviewHash(
      review.reviewer_name || null,
      review.text || null,
      review.published_date
    );

    const result = await query(`
      INSERT INTO reviews (
        business_id, review_id, reviewer_name, rating, text,
        published_date, sentiment_score, sentiment_label,
        complaint_category, severity_score, urgency_level,
        owner_response, owner_response_date,
        source, language, review_hash, raw_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb
      )
      ON CONFLICT (business_id, review_hash) DO UPDATE
      SET
        rating = EXCLUDED.rating,
        text = EXCLUDED.text,
        sentiment_score = EXCLUDED.sentiment_score,
        sentiment_label = EXCLUDED.sentiment_label,
        complaint_category = EXCLUDED.complaint_category,
        severity_score = EXCLUDED.severity_score,
        urgency_level = EXCLUDED.urgency_level,
        owner_response = EXCLUDED.owner_response,
        owner_response_date = EXCLUDED.owner_response_date,
        raw_data = EXCLUDED.raw_data
      RETURNING id
    `, [
      businessId,
      review.review_id || null,
      review.reviewer_name || null,
      review.rating,
      review.text || null,
      review.published_date,
      review.sentiment_score || null,
      review.sentiment_label || null,
      review.complaint_category || null,
      review.severity_score || null,
      review.urgency_level || null,
      review.owner_response || null,
      review.owner_response_date || null,
      review.source || 'apify',
      review.language || 'nl',
      reviewHash,
      review.raw_data ? JSON.stringify(review.raw_data) : null
    ]);

    return result.rows[0].id;
  }

  /**
   * Batch insert reviews (more efficient)
   */
  async insertBatch(businessId: string, reviews: any[]): Promise<string[]> {
    if (reviews.length === 0) return [];

    const reviewIds: string[] = [];

    // Use transaction for batch insert
    await transaction(async (client: PoolClient) => {
      for (const review of reviews) {
        const reviewHash = this.generateReviewHash(
          review.reviewerName || review.reviewer_name || null,
          review.text || review.reviewText || null,
          new Date(review.publishedAtDate || review.published_date || review.date)
        );

        const result = await client.query(`
          INSERT INTO reviews (
            business_id, review_id, reviewer_name, rating, text,
            published_date, source, language, review_hash, raw_data
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
          )
          ON CONFLICT (business_id, review_hash) DO NOTHING
          RETURNING id
        `, [
          businessId,
          review.reviewId || review.review_id || null,
          review.reviewerName || review.reviewer_name || null,
          review.stars || review.rating,
          review.text || review.reviewText || null,
          new Date(review.publishedAtDate || review.published_date || review.date),
          'apify',
          review.language || 'nl',
          reviewHash,
          JSON.stringify(review)
        ]);

        if (result.rows.length > 0) {
          reviewIds.push(result.rows[0].id);
        }
      }
    });

    console.log(`💾 Inserted ${reviewIds.length} new reviews for business`);
    return reviewIds;
  }

  /**
   * Get reviews for a business with filters
   */
  async getForBusiness(businessId: string, filters: {
    max_stars?: number;
    start_date?: Date;
    end_date?: Date;
    sentiment?: string;
    limit?: number;
  } = {}): Promise<CachedReview[]> {
    let conditions: string[] = ['business_id = $1'];
    let params: any[] = [businessId];
    let paramIndex = 2;

    if (filters.max_stars !== undefined) {
      conditions.push(`rating <= $${paramIndex}`);
      params.push(filters.max_stars);
      paramIndex++;
    }

    if (filters.start_date) {
      conditions.push(`published_date >= $${paramIndex}`);
      params.push(filters.start_date);
      paramIndex++;
    }

    if (filters.end_date) {
      conditions.push(`published_date <= $${paramIndex}`);
      params.push(filters.end_date);
      paramIndex++;
    }

    if (filters.sentiment) {
      conditions.push(`sentiment_label = $${paramIndex}`);
      params.push(filters.sentiment);
      paramIndex++;
    }

    const sql = `
      SELECT *
      FROM reviews
      WHERE ${conditions.join(' AND ')}
      ORDER BY published_date DESC
      LIMIT $${paramIndex}
    `;
    params.push(filters.limit || 100);

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get latest review date for a business
   * Used to determine incremental extraction start date
   */
  async getLatestReviewDate(businessId: string): Promise<Date | null> {
    const result = await query(`
      SELECT MAX(published_date) as latest_date
      FROM reviews
      WHERE business_id = $1
    `, [businessId]);

    return result.rows[0]?.latest_date || null;
  }

  /**
   * Count reviews by criteria
   */
  async count(filters: {
    business_id?: string;
    max_stars?: number;
    start_date?: Date;
    end_date?: Date;
  }): Promise<number> {
    let conditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (filters.business_id) {
      conditions.push(`business_id = $${paramIndex}`);
      params.push(filters.business_id);
      paramIndex++;
    }

    if (filters.max_stars !== undefined) {
      conditions.push(`rating <= $${paramIndex}`);
      params.push(filters.max_stars);
      paramIndex++;
    }

    if (filters.start_date) {
      conditions.push(`published_date >= $${paramIndex}`);
      params.push(filters.start_date);
      paramIndex++;
    }

    if (filters.end_date) {
      conditions.push(`published_date <= $${paramIndex}`);
      params.push(filters.end_date);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`
      SELECT COUNT(*) as count
      FROM reviews
      ${whereClause}
    `, params);

    return parseInt(result.rows[0].count);
  }

  /**
   * Get review statistics
   */
  async getStats(businessId?: string): Promise<{
    total: number;
    by_rating: Array<{ rating: number; count: number }>;
    by_sentiment: Array<{ sentiment: string; count: number }>;
    avg_rating: number;
    last_30_days: number;
    last_7_days: number;
  }> {
    const whereClause = businessId ? `WHERE business_id = $1` : '';
    const params = businessId ? [businessId] : [];

    const stats = await query(`
      SELECT
        COUNT(*) as total,
        ROUND(AVG(rating), 2) as avg_rating,
        COUNT(CASE WHEN published_date >= CURRENT_DATE - 30 THEN 1 END) as last_30_days,
        COUNT(CASE WHEN published_date >= CURRENT_DATE - 7 THEN 1 END) as last_7_days
      FROM reviews
      ${whereClause}
    `, params);

    const byRating = await query(`
      SELECT rating, COUNT(*) as count
      FROM reviews
      ${whereClause}
      GROUP BY rating
      ORDER BY rating DESC
    `, params);

    const bySentiment = await query(`
      SELECT sentiment_label as sentiment, COUNT(*) as count
      FROM reviews
      ${whereClause}
      WHERE sentiment_label IS NOT NULL
      GROUP BY sentiment_label
      ORDER BY count DESC
    `, params);

    return {
      ...stats.rows[0],
      by_rating: byRating.rows,
      by_sentiment: bySentiment.rows
    };
  }

  /**
   * Delete old reviews (data retention)
   */
  async deleteOld(daysToKeep: number = 365): Promise<number> {
    const result = await query(`
      WITH deleted AS (
        DELETE FROM reviews
        WHERE published_date < CURRENT_DATE - $1
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted
    `, [daysToKeep]);

    const deletedCount = parseInt(result.rows[0].count);
    console.log(`🗑️ Deleted ${deletedCount} reviews older than ${daysToKeep} days`);
    return deletedCount;
  }
}

export const reviewCache = new ReviewCacheService();
