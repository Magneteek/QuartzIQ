/**
 * Review Crawl History API
 * GET /api/review-crawl-history
 *
 * Fetches history of review crawl sessions with statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../database/db'

export async function GET(request: NextRequest) {
  try {
    // Group reviews by extraction date to create crawl sessions
    const result = await db.query<{
      rows: Array<{
        crawl_date: string
        total_reviews: number
        total_businesses: number
        avg_rating: number
        rating_1: number
        rating_2: number
        rating_3: number
        categories: string[]
        cities: string[]
      }>
    }>(`
      SELECT
        DATE(r.extracted_at) as crawl_date,
        COUNT(r.id) as total_reviews,
        COUNT(DISTINCT r.business_id) as total_businesses,
        AVG(r.rating)::NUMERIC(3,2) as avg_rating,
        COUNT(*) FILTER (WHERE r.rating = 1) as rating_1,
        COUNT(*) FILTER (WHERE r.rating = 2) as rating_2,
        COUNT(*) FILTER (WHERE r.rating = 3) as rating_3,
        ARRAY_AGG(DISTINCT b.category) FILTER (WHERE b.category IS NOT NULL) as categories,
        ARRAY_AGG(DISTINCT b.city) FILTER (WHERE b.city IS NOT NULL) as cities
      FROM reviews r
      JOIN businesses b ON r.business_id = b.id
      WHERE r.rating <= 3
        AND r.extracted_at >= NOW() - INTERVAL '90 days'
      GROUP BY DATE(r.extracted_at)
      ORDER BY DATE(r.extracted_at) DESC
      LIMIT 50
    `)

    // For each crawl session, get sample businesses
    const sessions = await Promise.all(
      result.rows.map(async (session) => {
        const sampleBusinesses = await db.query<{
          rows: Array<{
            business_name: string
            business_category: string
            business_city: string
            review_count: number
          }>
        }>(`
          SELECT
            b.name as business_name,
            b.category as business_category,
            b.city as business_city,
            COUNT(r.id) as review_count
          FROM reviews r
          JOIN businesses b ON r.business_id = b.id
          WHERE DATE(r.extracted_at) = $1
            AND r.rating <= 3
          GROUP BY b.id, b.name, b.category, b.city
          ORDER BY COUNT(r.id) DESC
          LIMIT 5
        `, [session.crawl_date])

        return {
          id: session.crawl_date,
          timestamp: session.crawl_date,
          statistics: {
            totalReviews: session.total_reviews,
            totalBusinesses: session.total_businesses,
            avgRating: parseFloat(session.avg_rating || '0'),
            ratingBreakdown: {
              1: session.rating_1,
              2: session.rating_2,
              3: session.rating_3
            }
          },
          metadata: {
            categories: session.categories,
            cities: session.cities,
            sampleBusinesses: sampleBusinesses.rows
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      sessions,
      totalSessions: sessions.length
    })

  } catch (error) {
    console.error('Review crawl history fetch error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
