/**
 * Update Alert Status
 * PATCH /api/alerts/[id]/status
 *
 * Updates the status of a monitoring alert
 */

import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

const VALID_STATUSES = ['new', 'in_progress', 'resolved', 'dismissed']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, notes } = body

    // Validate status
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Build update query based on status
    let updateQuery = `
      UPDATE customer_monitoring_alerts
      SET status = $1
    `
    const params_arr: any[] = [status, id]

    // Set timestamps based on status
    if (status === 'in_progress' && !notes) {
      updateQuery += `, acknowledged_at = COALESCE(acknowledged_at, CURRENT_TIMESTAMP)`
    } else if (status === 'resolved') {
      updateQuery += `, resolved_at = CURRENT_TIMESTAMP`
      if (notes) {
        updateQuery += `, resolution_notes = $3`
        params_arr.push(notes)
      }
    }

    updateQuery += ` WHERE id = $2 RETURNING *`

    // Update the alert
    const result = await pool.query(updateQuery, params_arr)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      )
    }

    const alert = result.rows[0]

    console.log('[Alert Status] Updated:', {
      alertId: id,
      newStatus: status,
      businessId: alert.business_id,
    })

    return NextResponse.json({
      success: true,
      alert: {
        id: alert.id,
        status: alert.status,
        business_id: alert.business_id,
        review_stars: alert.review_stars,
        review_text: alert.review_text,
        detected_at: alert.detected_at,
        acknowledged_at: alert.acknowledged_at,
        resolved_at: alert.resolved_at,
      },
    })

  } catch (error) {
    console.error('[Alert Status] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
