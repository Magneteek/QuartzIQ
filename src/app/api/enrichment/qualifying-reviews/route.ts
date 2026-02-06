import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { requireRoleAPI } from '@/lib/auth-helpers'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireRoleAPI(['admin', 'enrichment'])
    if (error) return error

    const { businessIds } = await request.json()

    if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
      return NextResponse.json(
        { error: 'businessIds array is required' },
        { status: 400 }
      )
    }

    // ✅ TWO-RULE QUALIFICATION SYSTEM
    // Fetch the qualifying review for each business using two-rule logic
    //
    // Rule 1: Recent reviews with content (1-3 stars, ≤14 days, has text OR image)
    // Rule 2: Reviews with images (1-3 stars, any age)
    //
    const query = `
      SELECT DISTINCT ON (business_id)
        business_id,
        rating,
        text,
        published_date,
        raw_data
      FROM reviews
      WHERE business_id = ANY($1::uuid[])
        AND rating BETWEEN 1 AND 3
        AND (
          -- Rule 1: Recent (≤14 days) + Has content (text OR image)
          (
            published_date >= CURRENT_DATE - INTERVAL '14 days'
            AND (
              (text IS NOT NULL AND text != '')
              OR (
                raw_data->'reviewImageUrls' IS NOT NULL
                AND jsonb_array_length(raw_data->'reviewImageUrls') > 0
              )
              OR (
                raw_data->'images' IS NOT NULL
                AND jsonb_array_length(raw_data->'images') > 0
              )
            )
          )
          OR
          -- Rule 2: Has image (any age, no time limit)
          (
            (
              raw_data->'reviewImageUrls' IS NOT NULL
              AND jsonb_array_length(raw_data->'reviewImageUrls') > 0
            )
            OR (
              raw_data->'images' IS NOT NULL
              AND jsonb_array_length(raw_data->'images') > 0
            )
          )
        )
      ORDER BY business_id, published_date DESC, rating ASC
    `

    const result = await pool.query(query, [businessIds])

    // Convert to a map of business_id -> review
    const reviews: Record<string, any> = {}
    result.rows.forEach(row => {
      reviews[row.business_id] = {
        rating: row.rating,
        text: row.text,
        published_date: row.published_date,
        raw_data: row.raw_data
      }
    })

    console.log(`📋 Fetched qualifying reviews for ${result.rows.length}/${businessIds.length} businesses`)

    return NextResponse.json({
      success: true,
      reviews,
      count: result.rows.length
    })

  } catch (error) {
    console.error('Error fetching qualifying reviews:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch qualifying reviews',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with businessIds array.' },
    { status: 405 }
  )
}
