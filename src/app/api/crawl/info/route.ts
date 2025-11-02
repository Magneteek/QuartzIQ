/**
 * GET /api/crawl/info
 * Get detailed crawl information for businesses from database
 *
 * Query params:
 *   - placeIds: comma-separated list of placeIds to check
 *
 * Returns: {
 *   [placeId]: {
 *     lastScrapedAt: timestamp,
 *     scrapeCount: number,
 *     daysSinceLastCrawl: number,
 *     isFresh: boolean (< 14 days),
 *     isStale: boolean (> 30 days)
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../database/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const placeIdsParam = searchParams.get('placeIds')

    if (!placeIdsParam) {
      return NextResponse.json(
        { error: 'placeIds parameter required' },
        { status: 400 }
      )
    }

    const placeIds = placeIdsParam.split(',').map(id => id.trim())

    // Query database for crawl information
    const result = await db.query(`
      SELECT
        place_id,
        last_scraped_at,
        scrape_count,
        EXTRACT(DAY FROM NOW() - last_scraped_at)::INTEGER as days_since_last_crawl,
        CASE
          WHEN last_scraped_at IS NULL THEN false
          WHEN last_scraped_at > NOW() - INTERVAL '14 days' THEN true
          ELSE false
        END as is_fresh,
        CASE
          WHEN last_scraped_at IS NULL THEN false
          WHEN last_scraped_at < NOW() - INTERVAL '30 days' THEN true
          ELSE false
        END as is_stale
      FROM businesses
      WHERE place_id = ANY($1::varchar[])
    `, [placeIds])

    // Format response as map
    const crawlInfo: Record<string, any> = {}

    for (const row of result.rows) {
      crawlInfo[row.place_id] = {
        lastScrapedAt: row.last_scraped_at,
        scrapeCount: row.scrape_count || 0,
        daysSinceLastCrawl: row.days_since_last_crawl,
        isFresh: row.is_fresh,
        isStale: row.is_stale,
        hasBeenCrawled: row.last_scraped_at !== null
      }
    }

    // Add null entries for placeIds not in database
    for (const placeId of placeIds) {
      if (!crawlInfo[placeId]) {
        crawlInfo[placeId] = {
          lastScrapedAt: null,
          scrapeCount: 0,
          daysSinceLastCrawl: null,
          isFresh: false,
          isStale: false,
          hasBeenCrawled: false
        }
      }
    }

    return NextResponse.json({ crawlInfo })

  } catch (error: any) {
    console.error('GET /api/crawl/info error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch crawl information' },
      { status: 500 }
    )
  }
}
