import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { requireRole } from '@/lib/auth-helpers'
import { z } from 'zod'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

const createReviewSchema = z.object({
  business_id: z.string().uuid(),
  reviewer_name: z.string().min(2),
  rating: z.number().min(1).max(5),
  review_text: z.string().min(10),
  review_date: z.string().optional(),
  response_text: z.string().optional(),
  source: z.enum(['google', 'facebook', 'yelp', 'other']).default('google'),
})

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin', 'va', 'enrichment'])

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json(
        { error: 'businessId is required' },
        { status: 400 }
      )
    }

    const result = await pool.query(
      `SELECT * FROM reviews
       WHERE business_id = $1
       ORDER BY review_date DESC, created_at DESC`,
      [businessId]
    )

    return NextResponse.json({ reviews: result.rows })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'va'])
    const body = await request.json()
    const validatedData = createReviewSchema.parse(body)

    // Insert review
    const result = await pool.query(
      `INSERT INTO reviews (
        business_id,
        reviewer_name,
        rating,
        review_text,
        review_date,
        response_text,
        source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        validatedData.business_id,
        validatedData.reviewer_name,
        validatedData.rating,
        validatedData.review_text,
        validatedData.review_date || null,
        validatedData.response_text || null,
        validatedData.source,
      ]
    )

    const newReview = result.rows[0]

    // Update business review counts and rating
    await pool.query(
      `UPDATE businesses
       SET total_reviews = (
         SELECT COUNT(*) FROM reviews WHERE business_id = $1
       ),
       rating = (
         SELECT AVG(rating)::DECIMAL(3,2) FROM reviews WHERE business_id = $1
       ),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [validatedData.business_id]
    )

    return NextResponse.json(
      { review: newReview },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error creating review:', error)
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    )
  }
}
