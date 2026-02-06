/**
 * Extract Reviews for Single Business
 * POST /api/extract-reviews-for-business
 *
 * Internal API - extracts reviews for a specific business by place ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../database/db'

export async function POST(request: NextRequest) {
  try {
    // Verify this is an internal request
    const isInternal = request.headers.get('X-Internal-Request') === 'true'
    if (!isInternal) {
      return NextResponse.json(
        { error: 'This endpoint is for internal use only' },
        { status: 403 }
      )
    }

    const { placeId, name, googleMapsUrl, maxReviews = 3 } = await request.json()

    if (!placeId) {
      return NextResponse.json(
        { error: 'placeId is required' },
        { status: 400 }
      )
    }

    // Call Apify to extract reviews
    const apifyToken = process.env.APIFY_API_TOKEN

    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured')
    }

    const apifyResponse = await fetch('https://api.apify.com/v2/acts/compass~google-maps-reviews-scraper/run-sync-get-dataset-items?token=' + apifyToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startUrls: [{ url: googleMapsUrl }],
        maxReviews: maxReviews,
        language: 'nl',
        scrapeReviewId: true,
        scrapeReviewUrl: true,
        scrapeReviewerId: true,
        scrapeReviewerUrl: true,
        scrapeReviewerNumberOfReviews: true,
        scrapeReviewResponses: true,
        scrapeResponseFromOwnerText: true,
      }),
      signal: AbortSignal.timeout(120000) // 2 minute timeout
    })

    if (!apifyResponse.ok) {
      throw new Error(`Apify API error: ${apifyResponse.statusText}`)
    }

    const reviewsData = await apifyResponse.json()

    // Insert reviews into database
    let insertedCount = 0

    if (Array.isArray(reviewsData) && reviewsData.length > 0) {
      for (const review of reviewsData) {
        try {
          // Get business ID from place_id
          const businessResult = await db.query(
            'SELECT id FROM businesses WHERE place_id = $1',
            [placeId]
          )

          if (businessResult.rows.length === 0) {
            console.error('Business not found for place_id:', placeId)
            continue
          }

          const businessId = businessResult.rows[0].id

          // Insert review
          await db.query(`
            INSERT INTO reviews (
              business_id,
              review_id,
              reviewer_name,
              rating,
              text,
              published_date,
              extracted_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (business_id, review_id)
            DO UPDATE SET
              text = EXCLUDED.text,
              extracted_at = NOW()
          `, [
            businessId,
            review.reviewId || `review_${Date.now()}_${Math.random()}`,
            review.name || 'Anonymous',
            review.stars || 0,
            review.text || '',
            review.publishedAtDate ? new Date(review.publishedAtDate) : new Date()
          ])

          insertedCount++
        } catch (insertError) {
          console.error('Error inserting review:', insertError)
        }
      }

      // Update business review count
      await db.query(`
        UPDATE businesses
        SET
          reviews_count = (
            SELECT COUNT(*)
            FROM reviews
            WHERE business_id = (SELECT id FROM businesses WHERE place_id = $1)
          ),
          last_updated_at = NOW()
        WHERE place_id = $1
      `, [placeId])
    }

    return NextResponse.json({
      success: true,
      placeId,
      name,
      reviewCount: insertedCount,
      totalReviewsFound: Array.isArray(reviewsData) ? reviewsData.length : 0
    })

  } catch (error) {
    console.error('Review extraction error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
