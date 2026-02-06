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

const enrichmentSchema = z.object({
  first_name: z.string().min(1, 'First name required').optional(),
  last_name: z.string().min(1, 'Last name required').optional(),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  enrichment_status: z.enum(['pending', 'in_progress', 'completed', 'failed']).optional(),
  enrichment_source: z.enum(['manual', 'apollo', 'apify', 'multiple']).optional(),
  enrichment_confidence: z.number().int().min(0).max(100).optional(),
  complete_enrichment: z.boolean().optional(), // Special flag to mark as fully enriched
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireRoleAPI(['admin', 'enrichment'])
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const validatedData = enrichmentSchema.parse(body)

    // Get current business data
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

    // Build update query
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    // Map fields
    const fieldMapping: Record<string, string> = {
      // No mapping needed for these fields
    }

    Object.entries(validatedData).forEach(([key, value]) => {
      if (key === 'complete_enrichment') return // Handle separately
      if (value !== undefined) {
        const dbColumn = fieldMapping[key] || key
        updates.push(`${dbColumn} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    })

    // If complete_enrichment flag is true, update additional fields
    if (validatedData.complete_enrichment) {
      // Set enrichment as completed
      updates.push(`enrichment_status = $${paramIndex}`)
      values.push('completed')
      paramIndex++

      updates.push(`enrichment_completed_at = CURRENT_TIMESTAMP`)

      updates.push(`enriched_by = $${paramIndex}`)
      values.push(session?.user?.id || null)
      paramIndex++

      // Move to qualified stage if not already
      if (currentBusiness.lifecycle_stage !== 'qualified') {
        updates.push(`lifecycle_stage = $${paramIndex}`)
        values.push('qualified')
        paramIndex++

        updates.push(`lifecycle_updated_at = CURRENT_TIMESTAMP`)
      }

      // Set enrichment_started_at if not set
      if (!currentBusiness.enrichment_started_at) {
        updates.push(`enrichment_started_at = CURRENT_TIMESTAMP`)
      }
    } else if (validatedData.enrichment_status === 'in_progress' && !currentBusiness.enrichment_started_at) {
      // Set started timestamp if moving to in_progress
      updates.push(`enrichment_started_at = CURRENT_TIMESTAMP`)
    }

    // Always update last_updated_at
    updates.push(`last_updated_at = CURRENT_TIMESTAMP`)

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

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
        validatedData.complete_enrichment ? 'enrichment_completed' : 'enrichment_updated',
        JSON.stringify(currentBusiness),
        JSON.stringify(updatedBusiness),
        validatedData.complete_enrichment
          ? 'Contact information enriched and marked as qualified'
          : 'Enrichment data updated',
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
    console.error('Error updating enrichment:', error)
    return NextResponse.json(
      { error: 'Failed to update enrichment' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireRoleAPI(['admin', 'enrichment'])
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
