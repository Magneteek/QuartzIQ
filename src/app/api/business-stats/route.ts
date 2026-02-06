/**
 * Business Cache Statistics API
 * GET /api/business-stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../database/db'

export async function GET(request: NextRequest) {
  try {
    // Total businesses count
    const totalResult = await db.query(
      'SELECT COUNT(*) as count FROM businesses'
    )
    const totalBusinesses = parseInt(totalResult.rows[0].count)

    // Businesses by scrape status
    const scrapeStats = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE last_scraped_at IS NOT NULL) as scraped_count,
        COUNT(*) FILTER (WHERE last_scraped_at IS NULL) as never_scraped,
        COUNT(*) FILTER (WHERE last_scraped_at > NOW() - INTERVAL '7 days') as scraped_last_7_days,
        COUNT(*) FILTER (WHERE last_scraped_at > NOW() - INTERVAL '30 days') as scraped_last_30_days,
        AVG(scrape_count)::NUMERIC(10,2) as avg_scrape_count,
        MAX(scrape_count) as max_scrape_count
      FROM businesses
    `)

    // Top categories
    const categoriesResult = await db.query(`
      SELECT category, COUNT(*) as count
      FROM businesses
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `)

    // Top cities
    const citiesResult = await db.query(`
      SELECT city, country_code, COUNT(*) as count
      FROM businesses
      WHERE city IS NOT NULL
      GROUP BY city, country_code
      ORDER BY count DESC
      LIMIT 10
    `)

    // Average rating
    const ratingResult = await db.query(`
      SELECT
        AVG(rating)::NUMERIC(3,2) as avg_rating,
        MIN(rating) as min_rating,
        MAX(rating) as max_rating,
        SUM(reviews_count)::BIGINT as total_reviews
      FROM businesses
      WHERE rating IS NOT NULL
    `)

    // Storage size estimate
    const sizeResult = await db.query(`
      SELECT
        pg_size_pretty(pg_total_relation_size('businesses')) as businesses_table_size,
        pg_size_pretty(pg_total_relation_size('reviews')) as reviews_table_size
    `)

    // Format response
    const stats = {
      overview: {
        totalBusinesses,
        scrapedCount: parseInt(scrapeStats.rows[0].scraped_count),
        neverScraped: parseInt(scrapeStats.rows[0].never_scraped),
      },
      recentActivity: {
        scrapedLast7Days: parseInt(scrapeStats.rows[0].scraped_last_7_days),
        scrapedLast30Days: parseInt(scrapeStats.rows[0].scraped_last_30_days),
        avgScrapeCount: parseFloat(scrapeStats.rows[0].avg_scrape_count || '0'),
        maxScrapeCount: scrapeStats.rows[0].max_scrape_count || 0,
      },
      quality: {
        avgRating: parseFloat(ratingResult.rows[0]?.avg_rating || '0'),
        minRating: ratingResult.rows[0]?.min_rating || 0,
        maxRating: ratingResult.rows[0]?.max_rating || 0,
        totalReviews: parseInt(ratingResult.rows[0]?.total_reviews || '0'),
      },
      topCategories: categoriesResult.rows.map((row: any) => ({
        category: row.category,
        count: parseInt(row.count),
      })),
      topLocations: citiesResult.rows.map((row: any) => ({
        city: row.city,
        countryCode: row.country_code,
        count: parseInt(row.count),
      })),
      storage: {
        businessesTableSize: sizeResult.rows[0]?.businesses_table_size || 'N/A',
        reviewsTableSize: sizeResult.rows[0]?.reviews_table_size || 'N/A',
      },
      costSavings: {
        apiCallsSaved: totalBusinesses,
        estimatedSavings: (totalBusinesses * 0.25).toFixed(2),
      },
    }

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('Error fetching business statistics:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
