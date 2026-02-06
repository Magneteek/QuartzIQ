/**
 * Uncrawled Businesses Analysis API
 * GET /api/uncrawled-analysis
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../database/db'

export async function GET(request: NextRequest) {
  try {
    // Overview of uncrawled businesses
    const overviewResult = await db.query(`
      SELECT
        COUNT(*) as total_uncrawled,
        COUNT(*) FILTER (WHERE reviews_count > 0) as with_reviews_data,
        COUNT(*) FILTER (WHERE reviews_count = 0 OR reviews_count IS NULL) as without_reviews_data,
        AVG(reviews_count)::NUMERIC(10,2) as avg_reviews,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY reviews_count) as median_reviews,
        SUM(reviews_count)::BIGINT as total_reviews,
        MAX(reviews_count) as max_reviews
      FROM businesses
      WHERE last_scraped_at IS NULL
    `)

    // Distribution by review count ranges
    const distributionResult = await db.query(`
      SELECT
        CASE
          WHEN reviews_count = 0 OR reviews_count IS NULL THEN '0 reviews'
          WHEN reviews_count BETWEEN 1 AND 10 THEN '1-10 reviews'
          WHEN reviews_count BETWEEN 11 AND 50 THEN '11-50 reviews'
          WHEN reviews_count BETWEEN 51 AND 100 THEN '51-100 reviews'
          WHEN reviews_count BETWEEN 101 AND 500 THEN '101-500 reviews'
          WHEN reviews_count > 500 THEN '500+ reviews'
        END as range,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM businesses
      WHERE last_scraped_at IS NULL
      GROUP BY range
      ORDER BY MIN(COALESCE(reviews_count, 0))
    `)

    // Top uncrawled businesses by review count (high-value targets)
    const topTargetsResult = await db.query(`
      SELECT
        name,
        category,
        city,
        reviews_count,
        rating::NUMERIC(2,1) as rating,
        place_id
      FROM businesses
      WHERE last_scraped_at IS NULL
        AND reviews_count > 0
      ORDER BY reviews_count DESC
      LIMIT 20
    `)

    // Category breakdown for uncrawled businesses
    const categoryResult = await db.query(`
      SELECT
        category,
        COUNT(*) as count,
        AVG(reviews_count)::NUMERIC(10,2) as avg_reviews,
        SUM(reviews_count)::BIGINT as total_reviews
      FROM businesses
      WHERE last_scraped_at IS NULL
        AND category IS NOT NULL
      GROUP BY category
      ORDER BY total_reviews DESC
      LIMIT 15
    `)

    // Location breakdown for uncrawled businesses
    const locationResult = await db.query(`
      SELECT
        city,
        country_code,
        COUNT(*) as count,
        AVG(reviews_count)::NUMERIC(10,2) as avg_reviews,
        SUM(reviews_count)::BIGINT as total_reviews
      FROM businesses
      WHERE last_scraped_at IS NULL
        AND city IS NOT NULL
      GROUP BY city, country_code
      ORDER BY total_reviews DESC
      LIMIT 15
    `)

    // Quality tier analysis (based on rating)
    const qualityResult = await db.query(`
      SELECT
        CASE
          WHEN rating >= 4.5 THEN 'Excellent (4.5-5.0)'
          WHEN rating >= 4.0 THEN 'Good (4.0-4.4)'
          WHEN rating >= 3.5 THEN 'Average (3.5-3.9)'
          WHEN rating < 3.5 THEN 'Below Average (<3.5)'
          ELSE 'No Rating'
        END as tier,
        COUNT(*) as count,
        AVG(reviews_count)::NUMERIC(10,2) as avg_reviews,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM businesses
      WHERE last_scraped_at IS NULL
      GROUP BY tier
      ORDER BY MIN(COALESCE(rating, 0)) DESC
    `)

    // Format response
    const analysis = {
      overview: {
        totalUncrawled: parseInt(overviewResult.rows[0].total_uncrawled),
        withReviewsData: parseInt(overviewResult.rows[0].with_reviews_data),
        withoutReviewsData: parseInt(overviewResult.rows[0].without_reviews_data),
        avgReviews: parseFloat(overviewResult.rows[0].avg_reviews || '0'),
        medianReviews: parseFloat(overviewResult.rows[0].median_reviews || '0'),
        totalReviews: parseInt(overviewResult.rows[0].total_reviews || '0'),
        maxReviews: parseInt(overviewResult.rows[0].max_reviews || '0'),
      },
      distribution: distributionResult.rows.map((row: any) => ({
        range: row.range,
        count: parseInt(row.count),
        percentage: parseFloat(row.percentage),
      })),
      topTargets: topTargetsResult.rows.map((row: any) => ({
        name: row.name,
        category: row.category,
        city: row.city,
        reviewsCount: row.reviews_count,
        rating: parseFloat(row.rating || '0'),
        placeId: row.place_id,
      })),
      byCategory: categoryResult.rows.map((row: any) => ({
        category: row.category,
        count: parseInt(row.count),
        avgReviews: parseFloat(row.avg_reviews || '0'),
        totalReviews: parseInt(row.total_reviews || '0'),
      })),
      byLocation: locationResult.rows.map((row: any) => ({
        city: row.city,
        countryCode: row.country_code,
        count: parseInt(row.count),
        avgReviews: parseFloat(row.avg_reviews || '0'),
        totalReviews: parseInt(row.total_reviews || '0'),
      })),
      byQuality: qualityResult.rows.map((row: any) => ({
        tier: row.tier,
        count: parseInt(row.count),
        avgReviews: parseFloat(row.avg_reviews || '0'),
        percentage: parseFloat(row.percentage),
      })),
    }

    return NextResponse.json({
      success: true,
      analysis,
    })
  } catch (error) {
    console.error('Error analyzing uncrawled businesses:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
