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
    const daysBackParam = searchParams.get('daysBack')
    const daysBack = daysBackParam ? parseInt(daysBackParam) : null
    const withImages = searchParams.get('withImages') === 'true'

    // Build WHERE conditions dynamically
    const conditions = [
      'r.rating >= $1',
      'r.rating <= $2',
      'r.text IS NOT NULL',
      'LENGTH(r.text) > 20'
    ]
    const params: any[] = [minRating, maxRating]
    let paramCount = 2

    // Add date filter only if daysBack is specified
    if (daysBack !== null) {
      paramCount++
      conditions.push(`r.published_date >= CURRENT_DATE - INTERVAL '1 day' * $${paramCount}`)
      params.push(daysBack)
    }

    // Add images filter if requested
    if (withImages) {
      conditions.push(`(
        (r.raw_data->'reviewImageUrls' IS NOT NULL AND jsonb_array_length(r.raw_data->'reviewImageUrls') > 0)
        OR (r.raw_data->'images' IS NOT NULL AND jsonb_array_length(r.raw_data->'images') > 0)
      )`)
    }

    paramCount++
    params.push(limit)

    // First, get total count and stats WITHOUT limit
    const statsQuery = await db.query(`
      SELECT
        COUNT(*) as total_reviews,
        COUNT(DISTINCT r.business_id) as unique_businesses,
        AVG(r.rating) as avg_rating,
        COUNT(CASE WHEN r.rating = 1 THEN 1 END) as rating_1_count,
        COUNT(CASE WHEN r.rating = 2 THEN 1 END) as rating_2_count,
        COUNT(CASE WHEN r.rating = 3 THEN 1 END) as rating_3_count
      FROM reviews r
      JOIN businesses b ON r.business_id = b.id
      WHERE ${conditions.join('\n        AND ')}
    `, params.slice(0, -1)) // Remove limit param for stats query

    const statsRow = statsQuery.rows[0]

    // Then fetch the actual reviews with limit
    const result = await db.query(`
      SELECT
        r.review_id,
        r.business_id,
        b.name as business_name,
        b.category as business_category,
        b.city as business_city,
        b.phone as business_phone,
        b.website as business_website,
        b.email as business_email,
        b.first_name as business_first_name,
        b.last_name as business_last_name,
        b.address as business_address,
        b.rating as business_rating,
        b.reviews_count as business_reviews_count,
        b.lifecycle_stage as business_lifecycle_stage,
        b.enrichment_status as business_enrichment_status,
        b.place_id as business_place_id,
        r.reviewer_name,
        r.rating,
        r.text,
        r.published_date,
        r.extracted_at,
        r.sentiment_score,
        r.sentiment_label,
        r.complaint_category,
        r.severity_score,
        r.urgency_level,
        r.raw_data
      FROM reviews r
      JOIN businesses b ON r.business_id = b.id
      WHERE ${conditions.join('\n        AND ')}
      ORDER BY r.published_date DESC, r.rating ASC
      LIMIT $${paramCount}
    `, params)

    // Calculate statistics from the stats query (not limited results)
    const stats = {
      totalReviews: parseInt(statsRow.total_reviews),
      averageRating: statsRow.avg_rating ? parseFloat(statsRow.avg_rating).toFixed(2) : '0',
      uniqueBusinesses: parseInt(statsRow.unique_businesses),
      ratingBreakdown: {
        1: parseInt(statsRow.rating_1_count),
        2: parseInt(statsRow.rating_2_count),
        3: parseInt(statsRow.rating_3_count)
      },
      showing: result.rows.length // How many we're displaying
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
