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
    const businessesResult = await db.query(`
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
    const reviewsResult = await db.query(`
      SELECT
        r.id,
        r.business_id,
        r.reviewer_name,
        r.rating,
        r.text,
        r.published_date,
        r.language as original_language,
        r.raw_data
      FROM reviews r
      WHERE DATE(r.extracted_at) = $1
        AND r.rating <= 3
      ORDER BY r.rating ASC, r.published_date DESC
    `, [date])

    // Group reviews by business
    const reviewsByBusiness: Record<string, any[]> = {}
    reviewsResult.rows.forEach((review: any) => {
      if (!reviewsByBusiness[review.business_id]) {
        reviewsByBusiness[review.business_id] = []
      }
      reviewsByBusiness[review.business_id].push(review)
    })

    // Format businesses with their reviews
    const businesses = businessesResult.rows.map((business: any) => ({
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
      qualifiedReviewCount: business.review_count_from_crawl
    }))

    // Extract all reviews into a flat array with business info
    const reviews = reviewsResult.rows.map((review: any) => {
      const business = businessesResult.rows.find((b: any) => b.business_id === review.business_id)
      // Extract additional fields from raw_data if available
      const rawData = review.raw_data || {}

      return {
        reviewId: review.id,
        name: review.reviewer_name,
        stars: review.rating,
        rating: review.rating,
        publishedAtDate: review.published_date,
        text: review.text,
        originalLanguage: review.original_language || 'nl',
        reviewUrl: rawData.reviewUrl || rawData.review_url || null,
        url: business?.google_maps_url || rawData.url,
        reviewerUrl: rawData.reviewerUrl || rawData.reviewer_url || null,
        reviewerNumberOfReviews: rawData.reviewerNumberOfReviews || rawData.reviewer_number_of_reviews || 0,
        isLocalGuide: rawData.isLocalGuide || rawData.is_local_guide || false,
        // Include business info for each review
        title: business?.name || 'Unknown Business',
        business_name: business?.name || 'Unknown Business',
        placeId: business?.place_id,
        address: business?.address,
        totalScore: business?.rating
      }
    })

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
        results: {
          businesses: businesses,
          reviews: reviews,
          searchCriteria: {
            category: 'Mixed',
            location: 'Netherlands',
            countryCode: 'NL',
            maxStars: 3
          },
          extractionDate: new Date(date)
        },
        statistics: {
          businessesFound: businesses.length,
          reviewsFound: reviewsResult.rows.length,
          avgRating: businesses.reduce((sum: number, b: any) => sum + b.totalScore, 0) / businesses.length || 0,
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
