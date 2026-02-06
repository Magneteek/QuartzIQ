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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['admin', 'va'])
    const { id } = await params

    // Get review to get business_id for updating stats
    const reviewResult = await pool.query(
      'SELECT business_id FROM reviews WHERE id = $1',
      [id]
    )

    if (reviewResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      )
    }

    const businessId = reviewResult.rows[0].business_id

    // Delete review
    await pool.query('DELETE FROM reviews WHERE id = $1', [id])

    // Update business review counts and rating
    await pool.query(
      `UPDATE businesses
       SET total_reviews = (
         SELECT COUNT(*) FROM reviews WHERE business_id = $1
       ),
       rating = (
         SELECT COALESCE(AVG(rating)::DECIMAL(3,2), 0) FROM reviews WHERE business_id = $1
       ),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [businessId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting review:', error)
    return NextResponse.json(
      { error: 'Failed to delete review' },
      { status: 500 }
    )
  }
}
