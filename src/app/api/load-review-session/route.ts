/**
 * Load Review Session API
 * GET /api/load-review-session?date=2025-01-27
 *
 * Loads businesses and qualified reviews from a specific crawl session
 * Returns data in the same format as /api/history for compatibility
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../database/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')

    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      )
    }

    // Fetch all businesses that had reviews extracted on this date
    const businessesResult = await db.query<{
      rows: Array<{
        business_id: string
        place_id: string
        name: string
        category: string
        city: string
        address: string
        phone: string
        website: string
        email: string
        rating: number
        reviews_count: number
        google_maps_url: string
        review_count_from_crawl: number
      }>
    }>(`
      SELECT
        b.id as business_id,
        b.place_id,
        b.name,
        b.category,
        b.city,
        b.address,
        b.phone,
        b.website,
        b.email,
        b.rating,
        b.reviews_count,
        b.google_maps_url,
        COUNT(r.id) as review_count_from_crawl
      FROM businesses b
      JOIN reviews r ON r.business_id = b.id
      WHERE DATE(r.extracted_at) = $1
        AND r.rating <= 3
      GROUP BY b.id, b.place_id, b.name, b.category, b.city, b.address,
               b.phone, b.website, b.email, b.rating, b.reviews_count, b.google_maps_url
      ORDER BY COUNT(r.id) DESC
    `, [date])

    // Fetch all qualified reviews from this date
    const reviewsResult = await db.query<{
      rows: Array<{
        business_id: string
        reviewer_name: string
        rating: number
        text: string
        published_date: string
      }>
    }>(`
      SELECT
        r.business_id,
        r.reviewer_name,
        r.rating,
        r.text,
        r.published_date
      FROM reviews r
      WHERE DATE(r.extracted_at) = $1
        AND r.rating <= 3
      ORDER BY r.rating ASC, r.published_date DESC
    `, [date])

    // Group reviews by business
    const reviewsByBusiness: Record<string, any[]> = {}
    reviewsResult.rows.forEach(review => {
      if (!reviewsByBusiness[review.business_id]) {
        reviewsByBusiness[review.business_id] = []
      }
      reviewsByBusiness[review.business_id].push(review)
    })

    // Format businesses with their reviews
    const businesses = businessesResult.rows.map(business => ({
      place_id: business.place_id,
      title: business.name,
      category: business.category,
      address: business.address,
      city: business.city,
      phone: business.phone,
      website: business.website,
      email: business.email,
      totalScore: business.rating,
      reviewsCount: business.reviews_count,
      googleMapsUrl: business.google_maps_url,
      reviews: reviewsByBusiness[business.business_id] || [],
      qualifiedReviewCount: business.review_count_from_crawl
    }))

    // Return in the same format as extraction history
    const response = {
      success: true,
      data: {
        id: `review-${date}`,
        timestamp: date,
        searchCriteria: {
          category: 'Mixed',
          location: 'Netherlands',
          countryCode: 'NL',
          maxStars: 3
        },
        results: businesses,
        statistics: {
          businessesFound: businesses.length,
          reviewsFound: reviewsResult.rows.length,
          avgRating: businesses.reduce((sum, b) => sum + b.totalScore, 0) / businesses.length || 0,
          extractionTime: 0
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Load review session error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
