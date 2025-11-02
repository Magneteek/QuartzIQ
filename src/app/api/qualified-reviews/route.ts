/**
 * Qualified Reviews API
 * GET /api/qualified-reviews
 *
 * Fetches low-star reviews (1-3 stars) from recently crawled businesses
 * These represent potential leads - dissatisfied customers of competitors
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../database/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const minRating = parseInt(searchParams.get('minRating') || '1')
    const maxRating = parseInt(searchParams.get('maxRating') || '3')
    const daysBack = parseInt(searchParams.get('daysBack') || '30')

    // Fetch qualified reviews (low-star reviews from recently crawled businesses)
    const result = await db.query<{
      rows: Array<{
        review_id: string
        business_id: string
        business_name: string
        business_category: string
        business_city: string
        business_phone: string
        business_website: string
        business_email: string
        business_address: string
        business_rating: number
        business_reviews_count: number
        reviewer_name: string
        rating: number
        text: string
        published_date: string
        extracted_at: string
        sentiment_score: number | null
        sentiment_label: string | null
        complaint_category: string | null
        severity_score: number | null
        urgency_level: string | null
      }>
    }>(`
      SELECT
        r.review_id,
        r.business_id,
        b.name as business_name,
        b.category as business_category,
        b.city as business_city,
        b.phone as business_phone,
        b.website as business_website,
        b.email as business_email,
        b.address as business_address,
        b.rating as business_rating,
        b.reviews_count as business_reviews_count,
        r.reviewer_name,
        r.rating,
        r.text,
        r.published_date,
        r.extracted_at,
        r.sentiment_score,
        r.sentiment_label,
        r.complaint_category,
        r.severity_score,
        r.urgency_level
      FROM reviews r
      JOIN businesses b ON r.business_id = b.id
      WHERE
        r.rating >= $1
        AND r.rating <= $2
        AND r.extracted_at >= NOW() - INTERVAL '1 day' * $3
        AND r.text IS NOT NULL
        AND LENGTH(r.text) > 20
      ORDER BY r.extracted_at DESC, r.rating ASC
      LIMIT $4
    `, [minRating, maxRating, daysBack, limit])

    // Calculate statistics
    const stats = {
      totalReviews: result.rows.length,
      averageRating: result.rows.length > 0
        ? (result.rows.reduce((sum, r) => sum + r.rating, 0) / result.rows.length).toFixed(2)
        : '0',
      uniqueBusinesses: new Set(result.rows.map(r => r.business_id)).size,
      ratingBreakdown: {
        1: result.rows.filter(r => r.rating === 1).length,
        2: result.rows.filter(r => r.rating === 2).length,
        3: result.rows.filter(r => r.rating === 3).length
      }
    }

    return NextResponse.json({
      success: true,
      reviews: result.rows,
      statistics: stats
    })

  } catch (error) {
    console.error('Qualified reviews fetch error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
