import { NextRequest, NextResponse } from 'next/server'
import { UniversalBusinessReviewExtractor, runningExtractions } from '../../../lib/extractor'
import { scrapedBusinessTracker } from '@/lib/scraped-businesses'
import { logger } from '@/lib/logger'
import { db } from '../../../../database/db'
import { generateCategoryWhereClause } from '@/lib/utils/category-mapping'
import { convertLegacyToUniversal, UniversalSearchCriteria } from '@/lib/types/universal-search'
import { universalSearchExtractor } from '@/lib/services/universal-extractor'
import { ApifyStatusTracker } from '@/lib/services/apify-status-tracker'

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
      businessLimit: searchCriteria.limits?.maxBusinesses || searchCriteria.businessLimit
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

    // 🆕 DETECT UNIVERSAL VS LEGACY FORMAT
    const isUniversalFormat = searchCriteria.businessFilters !== undefined ||
                              searchCriteria.enrichment !== undefined ||
                              searchCriteria.reviewFilters !== undefined ||
                              searchCriteria.limits !== undefined

    let universalCriteria: UniversalSearchCriteria
    if (isUniversalFormat) {
      universalCriteria = searchCriteria
      logger.info('Using universal search format', {
        enrichmentEnabled: searchCriteria.enrichment?.enabled,
        reviewsEnabled: searchCriteria.reviewFilters?.enabled,
      })
    } else {
      // Convert legacy to universal
      universalCriteria = convertLegacyToUniversal(searchCriteria)
      logger.info('Converted legacy to universal format', {
        businessLimit: searchCriteria.businessLimit,
      })
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
    console.log(`Business Limit: ${searchCriteria.limits?.maxBusinesses || searchCriteria.businessLimit || 50}`)
    console.log(`Max Stars: ${searchCriteria.reviewFilters?.maxStars || searchCriteria.maxStars || 3}`)
    console.log(`Day Limit: ${searchCriteria.reviewFilters?.dayLimit || searchCriteria.dayLimit || 14}`)
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

        // 🆕 Apify tracking variables (scoped to entire stream)
        let apifyTracker: ApifyStatusTracker | null = null
        let pollingInterval: NodeJS.Timeout | null = null

        try {
          sendUpdate('progress', { progress: 10, step: 'Initializing extraction system...' })

          // 🆕 UNIVERSAL SEARCH PATH (simplified, no legacy cache logic)
          if (isUniversalFormat) {
            sendUpdate('progress', { progress: 20, step: 'Using universal search system...' })
            sendUpdate('progress', { progress: 30, step: 'Finding businesses...' })

            // ✅ Pass useCached flag to universal extractor
            universalCriteria.useCached = searchCriteria.useCached || false

            // 🆕 Start polling for Apify run status (universal path)
            const requestedLimit = universalCriteria.limits?.maxBusinesses || 50
            const startUniversalApifyTracking = () => {
              pollingInterval = setInterval(async () => {
                try {
                  // Check if we have a run ID yet
                  const extraction = runningExtractions.get(extractionId)
                  if (!extraction || extraction.actorRunIds.length === 0) {
                    return // Wait for run to start
                  }

                  // Create tracker if we don't have one yet
                  if (!apifyTracker && extraction.actorRunIds.length > 0) {
                    const runId = extraction.actorRunIds[0] // Track the first (maps) actor
                    apifyTracker = new ApifyStatusTracker(runId, requestedLimit)
                    console.log(`📊 Started Apify tracking for run ${runId} (Universal Search)`)
                  }

                  // Get real-time progress
                  if (apifyTracker) {
                    const progress = await apifyTracker.getRealTimeProgress()

                    // Stream real-time data to frontend
                    sendUpdate('progress', {
                      progress: Math.max(30, progress.progressPercent), // Keep at least 30% during extraction
                      step: progress.stepMessage,
                      realTimeData: {
                        businessesFound: progress.businessesFound,
                        reviewsExtracted: progress.reviewsExtracted,
                        elapsedSeconds: progress.elapsedSeconds,
                        estimatedSecondsRemaining: progress.estimatedSecondsRemaining,
                        costEstimate: progress.costEstimate,
                        computeUnits: progress.computeUnits,
                        apifyRunId: extraction.actorRunIds[0],
                        apifyStatus: progress.status
                      }
                    })

                    // Stop polling if run completed
                    if (progress.status === 'SUCCEEDED' || progress.status === 'FAILED' || progress.status === 'ABORTED') {
                      if (pollingInterval) {
                        clearInterval(pollingInterval)
                        pollingInterval = null
                      }
                    }
                  }
                } catch (error: any) {
                  console.error('Apify tracking error (Universal):', error.message)
                }
              }, 2500) // Poll every 2.5 seconds
            }

            // Start tracking in background
            if (!universalCriteria.useCached) {
              // Only track if we're actually calling Apify (not using cached data)
              startUniversalApifyTracking()
            }

            // Use universal extractor (pass extractionId for tracking)
            const results = await universalSearchExtractor.search(universalCriteria, extractionId)

            sendUpdate('progress', { progress: 80, step: 'Processing results...' })

            // Send the final results
            sendUpdate('result', {
              result: {
                businesses: results.businesses,
                reviews: results.reviews || [],
                searchCriteria: results.searchCriteria,
                extractionDate: results.extractionDate,
              },
              summary: {
                totalBusinesses: results.stats.totalBusinesses,
                totalReviews: results.stats.totalReviews,
                extractionDate: results.extractionDate,
                enrichedBusinesses: results.stats.enrichedBusinesses,
                totalCostUsd: results.stats.totalCostUsd,
                savingsUsd: results.stats.savingsUsd,
              }
            })

            sendUpdate('progress', { progress: 100, step: 'Extraction completed successfully!' })

            console.log(`\n✅ UNIVERSAL SEARCH COMPLETED`)
            console.log(`══════════════════════════════════════════════════════`)
            console.log(`Request ID: ${requestId}`)
            console.log(`Businesses: ${results.stats.totalBusinesses}`)
            console.log(`Reviews: ${results.stats.totalReviews}`)
            console.log(`Enriched: ${results.stats.enrichedBusinesses}`)
            console.log(`Cost: $${results.stats.totalCostUsd}`)
            console.log(`Savings: $${results.stats.savingsUsd}`)
            console.log(`══════════════════════════════════════════════════════\n`)

            return // Exit early for universal search
          }

          // LEGACY SEARCH PATH (existing logic)
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
            LIMIT ${searchCriteria.limits?.maxBusinesses || searchCriteria.businessLimit || 50}
          `

          console.log('📋 Cache query:', cachedQuery)
          console.log('📋 Query params:', allParams)

          const cachedResult = await db.query(cachedQuery, allParams)
          placeIds = cachedResult.rows.map((row: any) => row.place_id)

          const requestedLimit = searchCriteria.limits?.maxBusinesses || searchCriteria.businessLimit || 50
          const cachedCount = placeIds?.length || 0
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

          // 🆕 Start polling for Apify run status
          const startApifyTracking = () => {
            pollingInterval = setInterval(async () => {
              try {
                // Check if we have a run ID yet
                const extraction = runningExtractions.get(extractionId)
                if (!extraction || extraction.actorRunIds.length === 0) {
                  return // Wait for run to start
                }

                // Create tracker if we don't have one yet
                if (!apifyTracker && extraction.actorRunIds.length > 0) {
                  const runId = extraction.actorRunIds[0] // Track the first (maps) actor
                  const targetBusinessCount = hybridMode ? newBusinessLimit : requestedLimit
                  apifyTracker = new ApifyStatusTracker(runId, targetBusinessCount)
                  console.log(`📊 Started Apify tracking for run ${runId}`)
                }

                // Get real-time progress
                if (apifyTracker) {
                  const progress = await apifyTracker.getRealTimeProgress()

                  // Stream real-time data to frontend
                  sendUpdate('progress', {
                    progress: Math.max(50, progress.progressPercent), // Keep at least 50% during extraction
                    step: progress.stepMessage,
                    realTimeData: {
                      businessesFound: progress.businessesFound,
                      reviewsExtracted: progress.reviewsExtracted,
                      elapsedSeconds: progress.elapsedSeconds,
                      estimatedSecondsRemaining: progress.estimatedSecondsRemaining,
                      costEstimate: progress.costEstimate,
                      computeUnits: progress.computeUnits,
                      apifyRunId: extraction.actorRunIds[0],
                      apifyStatus: progress.status
                    }
                  })

                  // Stop polling if run completed
                  if (progress.status === 'SUCCEEDED' || progress.status === 'FAILED' || progress.status === 'ABORTED') {
                    if (pollingInterval) {
                      clearInterval(pollingInterval)
                      pollingInterval = null
                    }
                  }
                }
              } catch (error: any) {
                console.error('Apify tracking error:', error.message)
              }
            }, 2500) // Poll every 2.5 seconds
          }

          // Start tracking in background
          startApifyTracking()

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

          // 🆕 Clean up Apify tracking
          if (pollingInterval) {
            clearInterval(pollingInterval)
            pollingInterval = null
            console.log(`📊 Stopped Apify tracking`)
          }

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
