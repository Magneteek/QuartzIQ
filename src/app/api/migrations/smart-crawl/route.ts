/**
 * Smart Crawl Migration API
 * POST /api/migrations/smart-crawl
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../database/db'
import * as fs from 'fs'
import * as path from 'path'

export async function POST(request: NextRequest) {
  try {
    console.log('📊 Starting Smart Crawl Strategy Migration...')

    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'database/migrations/004_smart_crawl_strategy.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('🔄 Executing migration SQL...')

    // Execute the migration
    await db.query(migrationSQL)

    console.log('✅ Migration completed successfully!')

    // Verify the changes
    const verifyResult = await db.query(`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'businesses'
        AND column_name IN (
          'last_review_check_at',
          'review_check_count',
          'had_reviews_on_discovery',
          'crawl_priority'
        )
      ORDER BY column_name
    `)

    // Show summary statistics
    const statsResult = await db.query(`
      SELECT
        crawl_priority,
        COUNT(*) as count,
        ROUND(AVG(reviews_count)::NUMERIC, 2) as avg_reviews
      FROM businesses
      GROUP BY crawl_priority
      ORDER BY
        CASE crawl_priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'standard' THEN 3
          WHEN 'low' THEN 4
        END
    `)

    // Show 0-review businesses
    const zeroReviewsResult = await db.query(`
      SELECT COUNT(*) as count
      FROM businesses
      WHERE reviews_count = 0 OR reviews_count IS NULL
    `)

    return NextResponse.json({
      success: true,
      message: 'Smart Crawl Strategy migration completed successfully!',
      newColumns: verifyResult.rows,
      priorityDistribution: statsResult.rows.map((row: any) => ({
        priority: row.crawl_priority,
        count: parseInt(row.count),
        avgReviews: parseFloat(row.avg_reviews || '0'),
      })),
      zeroReviewBusinesses: parseInt(zeroReviewsResult.rows[0].count),
      nextSteps: [
        'Test primary mode: GET /api/crawl/targets?mode=primary&limit=10',
        'Test secondary mode: GET /api/crawl/targets?mode=secondary&limit=10',
        'Read full guide: docs/SMART-CRAWL-STRATEGY.md',
      ],
    })
  } catch (error) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
