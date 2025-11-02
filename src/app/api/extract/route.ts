import { NextRequest, NextResponse } from 'next/server'
import { UniversalBusinessReviewExtractor, runningExtractions } from '../../../lib/extractor'
import { scrapedBusinessTracker } from '@/lib/scraped-businesses'
import { logger } from '@/lib/logger'
import { db } from '../../../../database/db'
import { generateCategoryWhereClause } from '@/lib/utils/category-mapping'

// 🔒 GLOBAL LOCK: Only allow ONE extraction at a time
let isExtractionRunning = false
let currentExtractionDetails: { category: string; location: string; startedAt: Date; extractionId: string } | null = null

export async function POST(request: NextRequest) {
  try {
    const searchCriteria = await request.json()
    const frontendRequestId = request.headers.get('X-Frontend-Request-Id') || 'unknown'

    // Log received request
    logger.info('Received extraction request', {
      frontendRequestId,
      category: searchCriteria.category,
      location: searchCriteria.location,
      businessLimit: searchCriteria.businessLimit
    })

    // Validate required fields
    if (!searchCriteria.category || !searchCriteria.location) {
      logger.error('Validation failed: missing required fields', {
        category: searchCriteria.category,
        location: searchCriteria.location
      })

      return NextResponse.json(
        { error: 'Category and location are required' },
        { status: 400 }
      )
    }

    // 🛡️ CRITICAL: Check if another extraction is already running
    if (isExtractionRunning) {
      logger.warn('Extraction blocked: another extraction in progress', {
        currentExtraction: {
          category: currentExtractionDetails?.category,
          location: currentExtractionDetails?.location,
          startedAt: currentExtractionDetails?.startedAt
        },
        blockedRequest: {
          category: searchCriteria.category,
          location: searchCriteria.location
        }
      })

      return NextResponse.json(
        {
          error: 'Another extraction is in progress',
          message: `Please wait. Currently extracting ${currentExtractionDetails?.category} in ${currentExtractionDetails?.location}`,
          currentExtraction: currentExtractionDetails,
          retryAfter: 60 // Suggest retry after 60 seconds
        },
        {
          status: 429, // 429 Too Many Requests
          headers: {
            'Retry-After': '60'
          }
        }
      )
    }

    // 🔒 SET THE LOCK
    const extractionId = `ext_${Date.now()}_${Math.random().toString(36).substring(7)}`
    isExtractionRunning = true
    currentExtractionDetails = {
      category: searchCriteria.category,
      location: searchCriteria.location,
      startedAt: new Date(),
      extractionId
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // 📊 LOG EXTRACTION START
    console.log(`\n🔵 EXTRACTION STARTED`)
    console.log(`══════════════════════════════════════════════════════`)
    console.log(`Request ID: ${requestId}`)
    console.log(`Extraction ID: ${extractionId}`)
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log(`Category: ${searchCriteria.category}`)
    console.log(`Location: ${searchCriteria.location}`)
    console.log(`Business Limit: ${searchCriteria.businessLimit || 50}`)
    console.log(`Max Stars: ${searchCriteria.maxStars || 3}`)
    console.log(`Day Limit: ${searchCriteria.dayLimit || 14}`)
    console.log(`Use Cached: ${searchCriteria.useCached || false}`)
    console.log(`Lock Status: ACQUIRED ✅`)
    console.log(`══════════════════════════════════════════════════════\n`)

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

          // Load already-scraped businesses for deduplication
          sendUpdate('progress', { progress: 15, step: 'Loading scraped business history...' })
          const scrapedBusinesses = await scrapedBusinessTracker.load()
          const excludePlaceIds = Object.keys(scrapedBusinesses)

          console.log(`📚 Loaded ${excludePlaceIds.length} previously scraped businesses for deduplication`)

          // 🎯 ALWAYS CHECK CACHE FIRST - Use cached businesses if available
          let placeIds: string[] | undefined = undefined

          sendUpdate('progress', { progress: 20, step: '💾 Checking for cached businesses...' })
          console.log('🎯 Checking database for cached businesses...')

          // Generate category WHERE clause with Dutch mappings
          const { clause: categoryClause, params: categoryParams } = generateCategoryWhereClause(
            searchCriteria.category,
            1
          )

          const locationParam = categoryParams.length + 1
          const allParams = [...categoryParams, `%${searchCriteria.location}%`]

          const cachedQuery = `
            SELECT place_id
            FROM businesses
            WHERE
              ${categoryClause}
              AND (LOWER(city) LIKE LOWER($${locationParam}) OR LOWER(address) LIKE LOWER($${locationParam}))
            LIMIT ${searchCriteria.businessLimit || 50}
          `

          console.log('📋 Cache query:', cachedQuery)
          console.log('📋 Query params:', allParams)

          const cachedResult = await db.query(cachedQuery, allParams)
          placeIds = cachedResult.rows.map((row: any) => row.place_id)

          const requestedLimit = searchCriteria.businessLimit || 50
          const cachedCount = placeIds.length
          const needsNewBusinesses = cachedCount < requestedLimit

          // 🎯 SMART HYBRID APPROACH: Cache + New Businesses
          let hybridMode = false
          let newBusinessLimit = 0

          if (cachedCount > 0 && needsNewBusinesses) {
            // HYBRID MODE: Use cache + search for additional businesses
            hybridMode = true
            newBusinessLimit = requestedLimit - cachedCount
            console.log(`🔀 HYBRID MODE: ${cachedCount} cached + ${newBusinessLimit} new = ${requestedLimit} total`)
            sendUpdate('progress', {
              progress: 35,
              step: `💰 Using ${cachedCount} cached + searching ${newBusinessLimit} new businesses...`
            })
          } else if (cachedCount > 0) {
            // CACHE ONLY: Have enough cached businesses
            console.log(`✅ CACHE ONLY: Using ${cachedCount} cached businesses (requested: ${requestedLimit})`)
            sendUpdate('progress', {
              progress: 35,
              step: `💰 Using ${cachedCount} cached businesses - saving costs!`
            })
          } else {
            // SEARCH ONLY: No cached businesses
            console.log(`🔍 SEARCH ONLY: No cache found, searching Google Maps for ${requestedLimit} businesses`)
            sendUpdate('progress', {
              progress: 30,
              step: `Searching Google Maps for ${requestedLimit} businesses...`
            })
          }

          // Create the real extractor for live data with extraction ID for abort capability
          console.log('Using real Apify extractor for live data extraction')
          const extractor = new UniversalBusinessReviewExtractor(extractionId)

          if (cachedCount === 0 || hybridMode) {
            // Show Google Maps search messages when searching
            sendUpdate('progress', { progress: 40, step: 'Connecting to Google Maps API...' })
            sendUpdate('progress', { progress: 50, step: 'Finding businesses on Google Maps...' })
          }

          // Run the real extraction with smart cache + search logic
          const results = await extractor.extractBusinessReviews({
            ...searchCriteria,
            // HYBRID MODE: Pass both cached IDs AND request new ones
            placeIds: placeIds && placeIds.length > 0 ? placeIds.join(',') : undefined,
            // If hybrid mode, adjust business limit to only get NEW businesses
            businessLimit: hybridMode ? newBusinessLimit : requestedLimit,
            // Deduplication: Exclude already-scraped businesses from review extraction
            excludePlaceIds: excludePlaceIds,
            // Simplified filter defaults - only user-controlled filters
            maxStars: searchCriteria.maxStars || 3,
            dayLimit: searchCriteria.dayLimit || 14,
            maxReviewsPerBusiness: searchCriteria.maxReviewsPerBusiness || 5,
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

          // 📊 LOG SUCCESSFUL COMPLETION
          console.log(`\n✅ EXTRACTION COMPLETED SUCCESSFULLY`)
          console.log(`══════════════════════════════════════════════════════`)
          console.log(`Request ID: ${requestId}`)
          console.log(`Duration: ${Date.now() - currentExtractionDetails!.startedAt.getTime()}ms`)
          console.log(`Businesses Found: ${results.businesses?.length || 0}`)
          console.log(`Reviews Found: ${results.reviews?.length || 0}`)
          console.log(`Lock Status: RELEASING... 🔓`)
          console.log(`══════════════════════════════════════════════════════\n`)

        } catch (error: any) {
          console.error(`\n❌ EXTRACTION ERROR`)
          console.error(`══════════════════════════════════════════════════════`)
          console.error(`Request ID: ${requestId}`)
          console.error(`Error: ${error.message}`)
          console.error(`Lock Status: RELEASING... 🔓`)
          console.error(`══════════════════════════════════════════════════════\n`)

          sendUpdate('error', {
            error: error.message || 'Unknown error occurred',
            step: 'Extraction failed'
          })
        } finally {
          // 🔓 CRITICAL: ALWAYS RELEASE THE LOCK
          isExtractionRunning = false
          currentExtractionDetails = null
          console.log(`🔓 LOCK RELEASED - System ready for next extraction\n`)

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

    // 🔓 Release lock on outer error too
    if (isExtractionRunning) {
      console.log('🔓 LOCK RELEASED due to outer error')
      isExtractionRunning = false
      currentExtractionDetails = null
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 📊 GET endpoint to check extraction status
export async function GET() {
  return NextResponse.json({
    isExtractionRunning,
    currentExtraction: currentExtractionDetails,
    message: isExtractionRunning
      ? `Extraction in progress: ${currentExtractionDetails?.category} in ${currentExtractionDetails?.location}`
      : 'No extraction currently running'
  })
}

// 🛑 DELETE endpoint to abort running extraction
export async function DELETE(request: NextRequest) {
  try {
    console.log('\n🛑 ABORT REQUEST RECEIVED')
    console.log('══════════════════════════════════════════════════════')

    // Check if there's a running extraction
    if (!isExtractionRunning || !currentExtractionDetails) {
      console.log('⚠️ No extraction currently running')
      return NextResponse.json(
        { error: 'No extraction currently running' },
        { status: 404 }
      )
    }

    const extractionId = currentExtractionDetails.extractionId
    console.log(`Extraction ID: ${extractionId}`)
    console.log(`Category: ${currentExtractionDetails.category}`)
    console.log(`Location: ${currentExtractionDetails.location}`)
    console.log(`Started at: ${currentExtractionDetails.startedAt}`)

    // Look up the extraction in the global tracking map
    const extraction = runningExtractions.get(extractionId)
    if (!extraction) {
      console.log('⚠️ Extraction not found in tracking map')
      return NextResponse.json(
        { error: 'Extraction tracking not found' },
        { status: 404 }
      )
    }

    console.log(`Actor runs to abort: ${extraction.actorRunIds.length}`)

    // Create an extractor instance to abort the actors
    const extractor = new UniversalBusinessReviewExtractor(extractionId)
    await extractor.abortExtraction()

    // Release the global lock
    isExtractionRunning = false
    currentExtractionDetails = null

    console.log('✅ EXTRACTION ABORTED SUCCESSFULLY')
    console.log('══════════════════════════════════════════════════════\n')

    return NextResponse.json({
      success: true,
      message: 'Extraction aborted successfully',
      abortedActors: extraction.actorRunIds.length
    })

  } catch (error: any) {
    console.error('❌ ABORT ERROR:', error)
    console.error('══════════════════════════════════════════════════════\n')

    return NextResponse.json(
      { error: error.message || 'Failed to abort extraction' },
      { status: 500 }
    )
  }
}
