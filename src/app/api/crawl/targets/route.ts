/**
 * Smart Crawl Targets API
 * GET /api/crawl/targets
 *
 * Returns businesses optimized for crawling based on:
 * 1. Primary crawl: Businesses WITH reviews (guaranteed data yield)
 * 2. Secondary crawl: Businesses WITHOUT reviews (periodic review checks)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../database/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const mode = searchParams.get('mode') || 'primary' // 'primary' or 'secondary'
    const limit = parseInt(searchParams.get('limit') || '100')
    const category = searchParams.get('category')
    const city = searchParams.get('city')
    const priority = searchParams.get('priority') // 'high', 'medium', 'standard', 'low'

    let query: string
    let params: any[]

    if (mode === 'primary') {
      // PRIMARY CRAWL: Businesses with reviews (guaranteed data)
      query = `
        SELECT
          b.id,
          b.place_id,
          b.name,
          b.category,
          b.city,
          b.address,
          b.reviews_count,
          b.rating,
          b.crawl_priority,
          b.last_scraped_at,
          b.scrape_count,
          EXTRACT(DAY FROM NOW() - COALESCE(b.last_scraped_at, b.first_discovered_at))::INTEGER as days_since_crawl,
          CASE
            WHEN b.last_scraped_at IS NULL THEN 'never_crawled'
            WHEN b.last_scraped_at < NOW() - INTERVAL '30 days' THEN 'stale'
            WHEN b.last_scraped_at < NOW() - INTERVAL '14 days' THEN 'aging'
            ELSE 'fresh'
          END as crawl_status
        FROM businesses b
        WHERE b.status = 'active'
          AND b.reviews_count > 0
          ${category ? 'AND b.category = $2' : ''}
          ${city ? `AND b.city = $${category ? '3' : '2'}` : ''}
          ${priority ? `AND b.crawl_priority = $${category && city ? '4' : category || city ? '3' : '2'}` : ''}
        ORDER BY
          -- Prioritize never crawled first
          CASE WHEN b.last_scraped_at IS NULL THEN 0 ELSE 1 END,
          -- Then by priority
          CASE
            WHEN b.crawl_priority = 'high' THEN 1
            WHEN b.crawl_priority = 'medium' THEN 2
            WHEN b.crawl_priority = 'standard' THEN 3
            ELSE 4
          END,
          -- Then by review count (descending)
          b.reviews_count DESC
        LIMIT $1
      `

      params = [limit]
      if (category) params.push(category)
      if (city) params.push(city)
      if (priority) params.push(priority)

    } else {
      // SECONDARY CRAWL: 0-review businesses ready for periodic check
      query = `
        SELECT
          b.id,
          b.place_id,
          b.name,
          b.category,
          b.city,
          b.address,
          b.reviews_count,
          b.rating,
          b.last_review_check_at,
          b.review_check_count,
          b.first_discovered_at,
          EXTRACT(DAY FROM NOW() - COALESCE(b.last_review_check_at, b.first_discovered_at))::INTEGER as days_since_check,
          CASE
            WHEN b.last_review_check_at IS NULL THEN 'never_checked'
            WHEN b.last_review_check_at < NOW() - INTERVAL '60 days' THEN 'overdue'
            WHEN b.last_review_check_at < NOW() - INTERVAL '30 days' THEN 'ready'
            ELSE 'recent'
          END as check_status
        FROM businesses b
        WHERE b.status = 'active'
          AND (b.reviews_count = 0 OR b.reviews_count IS NULL)
          AND (
            b.last_review_check_at IS NULL
            OR b.last_review_check_at < NOW() - INTERVAL '30 days'
          )
          ${category ? 'AND b.category = $2' : ''}
          ${city ? `AND b.city = $${category ? '3' : '2'}` : ''}
        ORDER BY
          -- Prioritize never checked first
          CASE WHEN b.last_review_check_at IS NULL THEN 0 ELSE 1 END,
          -- Then oldest checks
          b.last_review_check_at ASC NULLS FIRST,
          -- Then by discovery date (older = more likely to have reviews now)
          b.first_discovered_at ASC
        LIMIT $1
      `

      params = [limit]
      if (category) params.push(category)
      if (city) params.push(city)
    }

    const result = await db.query<{ rows: any[] }>(query, params)

    // Get summary statistics
    const statsQuery = mode === 'primary'
      ? `
        SELECT
          COUNT(*) FILTER (WHERE reviews_count > 0) as total_with_reviews,
          COUNT(*) FILTER (WHERE last_scraped_at IS NULL AND reviews_count > 0) as never_crawled,
          COUNT(*) FILTER (WHERE last_scraped_at < NOW() - INTERVAL '30 days' AND reviews_count > 0) as stale,
          COUNT(*) FILTER (WHERE crawl_priority = 'high') as high_priority,
          COUNT(*) FILTER (WHERE crawl_priority = 'medium') as medium_priority,
          COUNT(*) FILTER (WHERE crawl_priority = 'standard') as standard_priority
        FROM businesses
        WHERE status = 'active'
      `
      : `
        SELECT
          COUNT(*) FILTER (WHERE reviews_count = 0 OR reviews_count IS NULL) as total_zero_reviews,
          COUNT(*) FILTER (WHERE last_review_check_at IS NULL) as never_checked,
          COUNT(*) FILTER (WHERE last_review_check_at < NOW() - INTERVAL '30 days') as ready_for_check,
          COUNT(*) FILTER (WHERE last_review_check_at < NOW() - INTERVAL '60 days') as overdue_check,
          AVG(review_check_count)::NUMERIC(10,2) as avg_check_count
        FROM businesses
        WHERE status = 'active'
          AND (reviews_count = 0 OR reviews_count IS NULL)
      `

    const statsResult = await db.query<{ rows: any[] }>(statsQuery)

    return NextResponse.json({
      success: true,
      mode,
      targets: result.rows,
      count: result.rows.length,
      stats: statsResult.rows[0],
      recommendations: mode === 'primary' ? {
        message: 'Primary crawl targets - businesses with existing reviews',
        strategy: 'Crawl these businesses to extract review data immediately',
        expectedYield: 'Guaranteed review data from all targets',
      } : {
        message: 'Secondary crawl targets - checking for new reviews',
        strategy: 'Periodic checks on 0-review businesses to detect when they gain reviews',
        expectedYield: 'Some businesses may have acquired reviews since last check',
        checkInterval: '30 days recommended',
      },
    })
  } catch (error) {
    console.error('Error fetching crawl targets:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/crawl/targets/update
 * Update review check status after crawling
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { placeId, mode, reviewsFound } = body

    if (!placeId || !mode) {
      return NextResponse.json(
        { success: false, error: 'placeId and mode are required' },
        { status: 400 }
      )
    }

    if (mode === 'secondary') {
      // Update review check timestamp for 0-review checks
      const updateQuery = reviewsFound
        ? `
          -- Business gained reviews! Update to primary crawl target
          UPDATE businesses
          SET
            last_review_check_at = NOW(),
            review_check_count = review_check_count + 1,
            crawl_priority = CASE
              WHEN reviews_count >= 500 THEN 'high'
              WHEN reviews_count >= 100 THEN 'medium'
              ELSE 'standard'
            END,
            last_updated_at = NOW()
          WHERE place_id = $1
        `
        : `
          -- Still no reviews, update check timestamp
          UPDATE businesses
          SET
            last_review_check_at = NOW(),
            review_check_count = review_check_count + 1,
            last_updated_at = NOW()
          WHERE place_id = $1
        `

      await db.query(updateQuery, [placeId])

      return NextResponse.json({
        success: true,
        message: reviewsFound
          ? 'Business now has reviews - promoted to primary crawl target'
          : 'Review check timestamp updated',
      })
    }

    return NextResponse.json({
      success: true,
      message: 'No update needed for primary mode',
    })
  } catch (error) {
    console.error('Error updating crawl target:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
