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

const updateCustomerSchema = z.object({
  customer_tier: z.enum(['basic', 'premium', 'enterprise']).optional(),
  monitoring_enabled: z.boolean().optional(),
  monitoring_frequency_hours: z.number().int().min(1).max(168).optional(),
  monitoring_alert_threshold: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
  total_removed_reviews: z.number().int().min(0).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireRoleAPI(['admin', 'va', 'enrichment'])
    if (error) return error

    const { id } = await params

    // Get customer details
    const customerQuery = `
      SELECT
        b.*,
        COUNT(DISTINCT r.id) AS review_count,
        COUNT(DISTINCT cma.id) AS total_alerts,
        COUNT(DISTINCT cma.id) FILTER (WHERE cma.acknowledged_at IS NULL) AS unacknowledged_alerts,
        COUNT(DISTINCT cmh.id) AS total_checks,
        MAX(cmh.checked_at) AS last_check_time
      FROM businesses b
      LEFT JOIN reviews r ON b.id = r.business_id
      LEFT JOIN customer_monitoring_alerts cma ON b.id = cma.business_id
      LEFT JOIN customer_monitoring_history cmh ON b.id = cmh.business_id
      WHERE b.id = $1 AND b.is_paying_customer = TRUE
      GROUP BY b.id
    `

    const customerResult = await pool.query(customerQuery, [id])

    if (customerResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Get recent alerts
    const alertsQuery = `
      SELECT
        cma.*,
        r.text AS review_text,
        r.reviewer_name,
        r.published_date AS review_date
      FROM customer_monitoring_alerts cma
      LEFT JOIN reviews r ON cma.review_id = r.id
      WHERE cma.business_id = $1
      ORDER BY cma.detected_at DESC
      LIMIT 10
    `
    const alertsResult = await pool.query(alertsQuery, [id])

    // Get monitoring history
    const historyQuery = `
      SELECT *
      FROM customer_monitoring_history
      WHERE business_id = $1
      ORDER BY checked_at DESC
      LIMIT 20
    `
    const historyResult = await pool.query(historyQuery, [id])

    return NextResponse.json({
      customer: customerResult.rows[0],
      alerts: alertsResult.rows,
      history: historyResult.rows,
    })
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireRoleAPI(['admin'])
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const validatedData = updateCustomerSchema.parse(body)

    // Get current customer data
    const currentResult = await pool.query(
      'SELECT * FROM businesses WHERE id = $1 AND is_paying_customer = TRUE',
      [id]
    )

    if (currentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const currentCustomer = currentResult.rows[0]

    // Build update query
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    Object.entries(validatedData).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    })

    // Update next_monitoring_check if frequency changed
    if (validatedData.monitoring_frequency_hours) {
      updates.push(`next_monitoring_check = CURRENT_TIMESTAMP + ($${paramIndex} || ' hours')::INTERVAL`)
      values.push(validatedData.monitoring_frequency_hours)
      paramIndex++
    }

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
    const updatedCustomer = result.rows[0]

    // Log activity
    await pool.query(
      'SELECT log_lead_activity($1, $2, $3, $4, $5, $6)',
      [
        id,
        session?.user?.id || null,
        'customer_updated',
        JSON.stringify(currentCustomer),
        JSON.stringify(updatedCustomer),
        'Customer settings updated',
      ]
    )

    return NextResponse.json({ customer: updatedCustomer })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}
