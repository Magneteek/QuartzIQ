import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { requireRole } from '@/lib/auth-helpers'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['admin', 'va'])
    const { id } = await params

    const result = await pool.query(
      `SELECT
        id,
        reviewer_name,
        rating,
        text,
        published_date,
        sentiment_label,
        complaint_category,
        severity_score,
        urgency_level
      FROM reviews
      WHERE business_id = $1
      ORDER BY published_date DESC, rating ASC`,
      [id]
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['admin', 'va'])
    const { id } = await params
    const body = await request.json()

    // Validate required fields
    if (!body.reviewer_name || !body.rating || !body.text) {
      return NextResponse.json(
        { error: 'Missing required fields: reviewer_name, rating, text' },
        { status: 400 }
      )
    }

    // Insert review
    const result = await pool.query(
      `INSERT INTO reviews (
        business_id,
        reviewer_name,
        rating,
        text,
        published_date,
        source
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        id,
        body.reviewer_name,
        body.rating,
        body.text,
        body.published_date || new Date().toISOString(),
        body.source || 'manual',
      ]
    )

    return NextResponse.json(
      { success: true, review: result.rows[0] },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    )
  }
}
