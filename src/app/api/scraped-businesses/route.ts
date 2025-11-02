import { NextRequest, NextResponse } from 'next/server'
import { scrapedBusinessTracker, ScrapedBusiness } from '@/lib/scraped-businesses'

/**
 * GET /api/scraped-businesses
 * Load all scraped businesses or check specific ones
 * Query params:
 *   - check: comma-separated placeIds to check
 *   - stats: 'true' to get statistics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const checkPlaceIds = searchParams.get('check')
    const getStats = searchParams.get('stats') === 'true'

    // Get statistics
    if (getStats) {
      const stats = await scrapedBusinessTracker.getStats()
      return NextResponse.json({ stats })
    }

    // Check specific businesses
    if (checkPlaceIds) {
      const placeIds = checkPlaceIds.split(',')
      const results: Record<string, boolean> = {}

      for (const placeId of placeIds) {
        results[placeId] = await scrapedBusinessTracker.isScraped(placeId.trim())
      }

      return NextResponse.json({ results })
    }

    // Load all scraped businesses
    const businesses = await scrapedBusinessTracker.load()
    return NextResponse.json({ businesses })

  } catch (error: any) {
    console.error('GET /api/scraped-businesses error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load scraped businesses' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/scraped-businesses
 * Add businesses to scraped list
 * Body: { businesses: ScrapedBusiness[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businesses } = body

    if (!businesses || !Array.isArray(businesses)) {
      return NextResponse.json(
        { error: 'Invalid request: businesses array required' },
        { status: 400 }
      )
    }

    // Validate business objects
    for (const business of businesses) {
      if (!business.placeId || !business.businessName) {
        return NextResponse.json(
          { error: 'Invalid business: placeId and businessName required' },
          { status: 400 }
        )
      }
    }

    const addedCount = await scrapedBusinessTracker.addBusinesses(businesses)

    console.log(`📚 Added ${addedCount} new businesses to tracking (${businesses.length - addedCount} duplicates skipped)`)

    return NextResponse.json({
      success: true,
      addedCount,
      duplicatesSkipped: businesses.length - addedCount,
      message: `${addedCount} new businesses added to tracking`
    })

  } catch (error: any) {
    console.error('POST /api/scraped-businesses error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add businesses' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/scraped-businesses
 * Clear scraped businesses
 * Query params:
 *   - olderThan: number of days (optional) - only clear businesses older than this
 *   - all: 'true' to clear all businesses
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const olderThan = searchParams.get('olderThan')
    const clearAll = searchParams.get('all') === 'true'

    if (clearAll) {
      await scrapedBusinessTracker.clearAll()
      return NextResponse.json({
        success: true,
        message: 'All scraped businesses cleared'
      })
    }

    if (olderThan) {
      const days = parseInt(olderThan, 10)
      if (isNaN(days) || days < 1) {
        return NextResponse.json(
          { error: 'Invalid olderThan value: must be positive number' },
          { status: 400 }
        )
      }

      const removedCount = await scrapedBusinessTracker.clearOlderThan(days)
      return NextResponse.json({
        success: true,
        removedCount,
        message: `Removed ${removedCount} businesses older than ${days} days`
      })
    }

    return NextResponse.json(
      { error: 'Must specify either ?all=true or ?olderThan=days' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('DELETE /api/scraped-businesses error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to clear businesses' },
      { status: 500 }
    )
  }
}
