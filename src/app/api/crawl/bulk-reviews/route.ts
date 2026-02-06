/**
 * Bulk Review Crawl API
 * POST /api/crawl/bulk-reviews
 *
 * Triggers review extraction for selected businesses by place IDs
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../database/db'

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  // Create streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (update: any) => {
        controller.enqueue(encoder.encode(JSON.stringify(update) + '\n'))
      }

      try {
        const body = await request.json()
        const { placeIds, mode = 'primary', maxReviews = 3 } = body

        if (!placeIds || !Array.isArray(placeIds) || placeIds.length === 0) {
          sendUpdate({
            type: 'error',
            error: 'placeIds array is required'
          })
          controller.close()
          return
        }

        sendUpdate({
          type: 'progress',
          progress: 5,
          step: `Preparing to crawl ${placeIds.length} businesses...`
        })

        // Fetch business details from database
        const businessesResult = await db.query(`
          SELECT
            place_id,
            name,
            category,
            city,
            address,
            COALESCE(google_maps_url, google_profile_url) as google_maps_url,
            reviews_count
          FROM businesses
          WHERE place_id = ANY($1::varchar[])
        `, [placeIds])

        const businesses = businessesResult.rows

        if (businesses.length === 0) {
          sendUpdate({
            type: 'error',
            error: 'No businesses found with provided place IDs'
          })
          controller.close()
          return
        }

        sendUpdate({
          type: 'progress',
          progress: 10,
          step: `Found ${businesses.length} businesses in database`
        })

        // Process each business
        const results = []
        const errors = []

        for (let i = 0; i < businesses.length; i++) {
          const business = businesses[i]
          const progressPercent = 10 + ((i / businesses.length) * 80)

          sendUpdate({
            type: 'progress',
            progress: Math.round(progressPercent),
            step: `Crawling reviews for ${business.name} (${i + 1}/${businesses.length})...`,
            currentBusiness: business.name
          })

          try {
            // Call Apify to extract reviews for this specific business
            const reviewExtractionResponse = await fetch(`${request.nextUrl.origin}/api/extract-reviews-for-business`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Request': 'true'
              },
              body: JSON.stringify({
                placeId: business.place_id,
                name: business.name,
                googleMapsUrl: business.google_maps_url,
                maxReviews: maxReviews
              })
            })

            if (reviewExtractionResponse.ok) {
              const reviewData = await reviewExtractionResponse.json()
              results.push({
                placeId: business.place_id,
                name: business.name,
                reviewsExtracted: reviewData.reviewCount || 0,
                status: 'success'
              })

              // Update last_scraped_at timestamp
              await db.query(`
                UPDATE businesses
                SET
                  last_scraped_at = NOW(),
                  scrape_count = scrape_count + 1,
                  last_updated_at = NOW()
                WHERE place_id = $1
              `, [business.place_id])

            } else {
              throw new Error(`Failed to extract reviews: ${reviewExtractionResponse.statusText}`)
            }

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            errors.push({
              placeId: business.place_id,
              name: business.name,
              error: errorMsg
            })

            sendUpdate({
              type: 'progress',
              progress: Math.round(progressPercent),
              step: `Error crawling ${business.name}: ${errorMsg}`,
              error: errorMsg
            })
          }

          // Small delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Send final results
        sendUpdate({
          type: 'progress',
          progress: 95,
          step: 'Finalizing crawl results...'
        })

        // Update review check timestamp for all crawled businesses
        const updateResult = await db.query(`
          UPDATE businesses
          SET
            last_review_check_at = NOW(),
            review_check_count = review_check_count + 1
          WHERE place_id = ANY($1::varchar[])
          RETURNING place_id, last_review_check_at
        `, [placeIds])

        console.log(`✅ Updated timestamps for ${updateResult.rows.length} businesses:`, updateResult.rows)

        sendUpdate({
          type: 'result',
          progress: 100,
          step: 'Crawl completed!',
          results: {
            total: businesses.length,
            successful: results.length,
            failed: errors.length,
            details: results,
            errors: errors
          }
        })

        controller.close()

      } catch (error) {
        sendUpdate({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        })
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
