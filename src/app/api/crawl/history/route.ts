import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const sortBy = searchParams.get('sortBy') || 'date'
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build filters
    const conditions: string[] = []
    const params: any[] = []
    let paramIdx = 1

    if (search) {
      conditions.push(`b.name ILIKE $${paramIdx}`)
      params.push(`%${search}%`)
      paramIdx++
    }
    if (status) {
      conditions.push(`brc.status = $${paramIdx}`)
      params.push(status)
      paramIdx++
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const orderBy = sortBy === 'cost'
      ? 'brc.apify_cost_usd DESC'
      : sortBy === 'reviews'
      ? 'brc.reviews_found DESC'
      : 'brc.crawled_at DESC'

    // Fetch records
    const recordsResult = await pool.query(
      `SELECT
        brc.id,
        brc.business_id,
        b.name as business_name,
        b.city,
        b.category,
        brc.crawled_at,
        brc.crawl_duration_seconds,
        brc.reviews_found,
        brc.reviews_new,
        brc.is_incremental,
        brc.apify_cost_usd,
        brc.status,
        brc.error_message
       FROM business_review_crawls brc
       JOIN businesses b ON brc.business_id = b.id
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    )

    // Fetch aggregate stats (no filters)
    const statsResult = await pool.query(
      `SELECT
        COUNT(*)::int as total_crawls,
        COUNT(DISTINCT business_id)::int as total_businesses,
        COALESCE(SUM(reviews_found), 0)::int as total_reviews,
        COALESCE(SUM(apify_cost_usd), 0) as total_cost,
        CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(reviews_found)::numeric / COUNT(*), 1) ELSE 0 END as avg_reviews_per_crawl,
        COUNT(*) FILTER (WHERE is_incremental = true)::int as incremental_crawls,
        CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(apify_cost_usd)::numeric / COUNT(*), 4) ELSE 0 END as avg_cost_per_business
       FROM business_review_crawls`
    )

    return NextResponse.json({
      success: true,
      records: recordsResult.rows,
      stats: statsResult.rows[0],
      total: recordsResult.rows.length,
    })
  } catch (error: any) {
    console.error('[crawl/history] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
