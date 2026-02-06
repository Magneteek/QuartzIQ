/**
 * Review Storage Service
 * Handles storing qualified reviews (only those meeting filter criteria)
 * CRITICAL: Only stores reviews that qualify for reputation management
 */

import { db, query, transaction } from '../../../database/db'
import { PoolClient } from 'pg'
import { logger } from '../logger'

const reviewLogger = logger.child({ module: 'review-storage' })

export interface StoredReview {
  id: string
  business_id: string
  review_id: string
  reviewer_name: string
  rating: number
  text: string
  published_date: Date
  extracted_at: Date
  language: string | null
  sentiment_score: number | null
  sentiment_label: string | null
  raw_data: any
}

class ReviewStorageService {
  /**
   * Store a single qualified review
   * Returns review ID if stored, null if duplicate
   */
  async storeReview(review: {
    business_id: string
    review_id?: string
    reviewer_name: string
    rating: number
    text: string
    published_date: Date | string
    language?: string
    raw_data?: any
  }): Promise<string | null> {
    try {
      return await transaction(async (client: PoolClient) => {
        // Generate review_id if not provided (hash of business_id + reviewer + date + text)
        const reviewId =
          review.review_id ||
          `${review.business_id}-${review.reviewer_name}-${review.published_date}-${review.text.substring(0, 50)}`.replace(/[^a-zA-Z0-9-]/g, '')

        // Check if review already exists
        const existing = await client.query(
          `SELECT id FROM reviews WHERE review_id = $1`,
          [reviewId]
        )

        if (existing.rows.length > 0) {
          reviewLogger.debug('Review already stored, skipping', {
            review_id: reviewId,
          })
          return null // Duplicate, skip
        }

        // Insert new review
        const result = await client.query<{ id: string }>(
          `
          INSERT INTO reviews (
            business_id, review_id, reviewer_name, rating, text,
            published_date, extracted_at, language, raw_data
          ) VALUES (
            $1, $2, $3, $4, $5, $6, NOW(), $7, $8::jsonb
          )
          RETURNING id
        `,
          [
            review.business_id,
            reviewId,
            review.reviewer_name,
            review.rating,
            review.text,
            review.published_date,
            review.language || null,
            review.raw_data ? JSON.stringify(review.raw_data) : null,
          ]
        )

        reviewLogger.debug('Review stored', {
          review_id: reviewId,
          business_id: review.business_id,
          rating: review.rating,
        })

        return result.rows[0].id
      })
    } catch (error: any) {
      reviewLogger.error('Failed to store review', {
        error: error.message,
        business_id: review.business_id,
      })
      return null
    }
  }

  /**
   * Store multiple qualified reviews (batch operation)
   * Returns count of reviews stored (excluding duplicates)
   */
  async storeReviews(
    reviews: Array<{
      business_id: string
      review_id?: string
      reviewer_name: string
      rating: number
      text: string
      published_date: Date | string
      language?: string
      raw_data?: any
    }>
  ): Promise<{ stored: number; duplicates: number }> {
    let stored = 0
    let duplicates = 0

    for (const review of reviews) {
      const result = await this.storeReview(review)
      if (result) {
        stored++
      } else {
        duplicates++
      }
    }

    reviewLogger.info('Batch review storage complete', {
      total: reviews.length,
      stored,
      duplicates,
    })

    return { stored, duplicates }
  }

  /**
   * Get reviews for a specific business
   */
  async getReviewsByBusiness(businessId: string, limit: number = 100): Promise<StoredReview[]> {
    const result = await query(
      `
      SELECT *
      FROM reviews
      WHERE business_id = $1
      ORDER BY published_date DESC
      LIMIT $2
    `,
      [businessId, limit]
    )

    return result.rows
  }

  /**
   * Get recent qualified reviews (within last N days)
   */
  async getRecentReviews(days: number = 30, limit: number = 100): Promise<StoredReview[]> {
    const result = await query(
      `
      SELECT r.*, b.name as business_name, b.category, b.city
      FROM reviews r
      JOIN businesses b ON r.business_id = b.id
      WHERE r.published_date >= NOW() - INTERVAL '${days} days'
      ORDER BY r.published_date DESC
      LIMIT $1
    `,
      [limit]
    )

    return result.rows
  }

  /**
   * Get review statistics
   */
  async getStats(): Promise<{
    total_reviews: number
    reviews_last_7_days: number
    reviews_last_30_days: number
    avg_rating: number
    by_rating: Array<{ rating: number; count: number }>
  }> {
    const stats = await query(`
      SELECT
        COUNT(*) as total_reviews,
        COUNT(CASE WHEN published_date >= NOW() - INTERVAL '7 days' THEN 1 END) as reviews_last_7_days,
        COUNT(CASE WHEN published_date >= NOW() - INTERVAL '30 days' THEN 1 END) as reviews_last_30_days,
        ROUND(AVG(rating), 2) as avg_rating
      FROM reviews
    `)

    const byRating = await query(`
      SELECT rating, COUNT(*) as count
      FROM reviews
      GROUP BY rating
      ORDER BY rating DESC
    `)

    return {
      ...stats.rows[0],
      by_rating: byRating.rows,
    }
  }
}

export const reviewStorage = new ReviewStorageService()
