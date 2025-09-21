import { NextRequest, NextResponse } from 'next/server'
import { UniversalBusinessReviewExtractor } from '../../../lib/extractor'

export async function POST(request: NextRequest) {
  try {
    const searchCriteria = await request.json()

    // Validate required fields
    if (!searchCriteria.category || !searchCriteria.location) {
      return NextResponse.json(
        { error: 'Category and location are required' },
        { status: 400 }
      )
    }

    // Set up streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendUpdate = (type: string, data: any) => {
          const chunk = encoder.encode(`${JSON.stringify({ type, ...data })}\n`)
          controller.enqueue(chunk)
        }

        try {
          sendUpdate('progress', { progress: 10, step: 'Initializing extraction system...' })

          // Create the real extractor for live data
          console.log('Using real Apify extractor for live data extraction')
          const extractor = new UniversalBusinessReviewExtractor()
          sendUpdate('progress', { progress: 20, step: 'Connecting to Apify API...' })
          sendUpdate('progress', { progress: 30, step: 'Starting business search...' })

          // Add progress tracking during extraction
          sendUpdate('progress', { progress: 40, step: 'Finding businesses on Google Maps...' })

          // Run the real extraction
          const results = await extractor.extractBusinessReviews({
            ...searchCriteria,
            // Ensure we have sensible defaults for the search
            maxRating: searchCriteria.maxRating || 4.6,
            maxStars: searchCriteria.maxStars || 3,
            dayLimit: searchCriteria.dayLimit || 14,
            businessLimit: searchCriteria.businessLimit || 5,
            reviewLimit: searchCriteria.reviewLimit || 10,
            minReviews: searchCriteria.minReviews || 10,
            maxReviewsPerBusiness: searchCriteria.maxReviewsPerBusiness || 50,
            minTextLength: searchCriteria.minTextLength || 20,
            language: searchCriteria.language || 'nl',
            countryCode: searchCriteria.countryCode || 'nl'
          })

          sendUpdate('progress', { progress: 80, step: 'Extracting and filtering reviews...' })

          sendUpdate('progress', { progress: 90, step: 'Processing results...' })

          // Send the final results
          sendUpdate('result', {
            result: results,
            summary: {
              totalBusinesses: results.businesses?.length || 0,
              totalReviews: results.reviews?.length || 0,
              extractionDate: results.extractionDate || new Date()
            }
          })

          sendUpdate('progress', { progress: 100, step: 'Extraction completed successfully!' })

        } catch (error: any) {
          console.error('Extraction error:', error)
          sendUpdate('error', {
            error: error.message || 'Unknown error occurred',
            step: 'Extraction failed'
          })
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}