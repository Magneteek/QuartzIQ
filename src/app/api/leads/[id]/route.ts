import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { requireRoleAPI } from '@/lib/auth-helpers'
import { z } from 'zod'
import { auth } from '@/auth'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

const updateBusinessSchema = z.object({
  business_name: z.string().min(2).optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  website: z.string().url().or(z.literal('')).optional(),
  category: z.string().optional(),
  place_id: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  total_reviews: z.number().int().min(0).optional(),
  data_source: z.enum(['manual', 'scraper', 'import']).optional(),
  entry_method: z.enum(['manual_entry', 'google_maps_url', 'csv_import']).optional(),
  import_status: z.enum(['pending', 'completed', 'failed']).optional(),
  google_profile_url: z.string().url().or(z.literal('')).optional(),
  negative_review_url: z.string().url().or(z.literal('')).optional(),
  va_notes: z.string().optional(),
  enrichment_priority: z.number().int().min(0).max(100).optional(),
  ready_for_enrichment: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireRoleAPI(['admin', 'va', 'enrichment'])
    if (error) return error
    const { id } = await params

    const result = await pool.query(
      'SELECT * FROM businesses WHERE id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ business: result.rows[0] })
  } catch (error) {
    console.error('Error fetching business:', error)
    return NextResponse.json(
      { error: 'Failed to fetch business' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireRoleAPI(['admin', 'va'])
    if (error) return error
    const { id } = await params
    const body = await request.json()
    const validatedData = updateBusinessSchema.parse(body)

    // Get current business data for activity log
    const currentResult = await pool.query(
      'SELECT * FROM businesses WHERE id = $1',
      [id]
    )

    if (currentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    const currentBusiness = currentResult.rows[0]

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    // Map API field names to database column names
    const fieldMapping: Record<string, string> = {
      business_name: 'name',
      country: 'country_code',
      total_reviews: 'reviews_count',
    }

    Object.entries(validatedData).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbColumn = fieldMapping[key] || key
        updates.push(`${dbColumn} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    })

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Add last_updated_at
    updates.push(`last_updated_at = CURRENT_TIMESTAMP`)

    // Execute update
    values.push(id)
    const updateQuery = `
      UPDATE businesses
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await pool.query(updateQuery, values)
    const updatedBusiness = result.rows[0]

    // Log activity
    await pool.query(
      'SELECT log_lead_activity($1, $2, $3, $4, $5, $6)',
      [
        id,
        session?.user?.id || null,
        'updated',
        JSON.stringify(currentBusiness),
        JSON.stringify(updatedBusiness),
        'Business updated via Stage 1 interface',
      ]
    )

    return NextResponse.json({ business: updatedBusiness })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error updating business:', error)
    return NextResponse.json(
      { error: 'Failed to update business' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireRoleAPI(['admin', 'va'])
    if (error) return error
    const { id } = await params

    // Get business for activity log
    const businessResult = await pool.query(
      'SELECT * FROM businesses WHERE id = $1',
      [id]
    )

    if (businessResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    // Log deletion before deleting
    await pool.query(
      'SELECT log_lead_activity($1, $2, $3, $4, $5, $6)',
      [
        id,
        session?.user?.id || null,
        'deleted',
        JSON.stringify(businessResult.rows[0]),
        null,
        'Business deleted via Stage 1 interface',
      ]
    )

    // Delete business (will cascade to reviews and activity log)
    await pool.query('DELETE FROM businesses WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting business:', error)
    return NextResponse.json(
      { error: 'Failed to delete business' },
      { status: 500 }
    )
  }
}
