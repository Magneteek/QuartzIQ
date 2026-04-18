/**
 * GET /api/reviews/for-businesses
 * Returns filtered reviews from DB for a list of businesses by placeId.
 * Used after on-demand review extraction to get qualifying reviews for display.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../database/db'

export async function POST(request: NextRequest) {
  try {
    const { placeIds, maxStars = 3, dayLimit = 30 } = await request.json()

    if (!placeIds || !Array.isArray(placeIds) || placeIds.length === 0) {
      return NextResponse.json({ error: 'placeIds array required' }, { status: 400 })
    }

    // Build the date cutoff
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - dayLimit)

    // Query reviews joined with businesses, filtered by placeIds + maxStars + dayLimit
    const placeholders = placeIds.map((_: string, i: number) => `$${i + 1}`).join(', ')
    const result = await db.query(`
      SELECT
        r.id,
        r.review_id,
        r.reviewer_name,
        r.rating,
        r.text,
        r.published_date,
        r.url,
        r.owner_response,
        r.raw_data,
        b.place_id,
        b.name AS business_name,
        b.address,
        b.rating AS business_rating,
        b.reviews_count,
        b.google_maps_url,
        b.phone,
        b.website
      FROM reviews r
      JOIN businesses b ON r.business_id = b.id
      WHERE b.place_id IN (${placeholders})
        AND r.rating <= $${placeIds.length + 1}
        AND r.published_date >= $${placeIds.length + 2}
      ORDER BY r.published_date DESC
    `, [...placeIds, maxStars, cutoffDate.toISOString().split('T')[0]])

    // Shape the reviews into the format the dashboard expects
    const reviews = result.rows.map((row: Record<string, unknown>) => ({
      reviewId: row.review_id,
      name: row.reviewer_name,
      stars: row.rating,
      text: row.text,
      publishedAtDate: row.published_date,
      url: row.url,
      ownerResponse: row.owner_response,
      // Fields used by dashboard for business matching
      business_name: row.business_name,
      business_title: row.business_name,
      // Business context
      placeId: row.place_id,
      businessRating: row.business_rating,
    }))

    return NextResponse.json({
      success: true,
      reviews,
      count: reviews.length,
      filters: { maxStars, dayLimit, placeIds },
    })

  } catch (error) {
    console.error('Error fetching reviews for businesses:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
