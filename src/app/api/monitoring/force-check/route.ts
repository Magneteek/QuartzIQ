/**
 * API Route: Force Check Customers
 * POST /api/monitoring/force-check
 * Resets next_monitoring_check to NOW for immediate monitoring
 */

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

const forceCheckSchema = z.object({
  businessIds: z.array(z.string().uuid()).optional(),
  allCustomers: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin'])

    const body = await request.json()
    const { businessIds, allCustomers } = forceCheckSchema.parse(body)

    let result

    if (allCustomers) {
      // Reset all customers to be checked now
      result = await pool.query(`
        UPDATE businesses
        SET next_monitoring_check = CURRENT_TIMESTAMP
        WHERE lifecycle_stage = 'customer'
          AND monitoring_enabled = true
        RETURNING id, name
      `)
    } else if (businessIds && businessIds.length > 0) {
      // Reset specific customers
      result = await pool.query(`
        UPDATE businesses
        SET next_monitoring_check = CURRENT_TIMESTAMP
        WHERE id = ANY($1)
          AND lifecycle_stage = 'customer'
          AND monitoring_enabled = true
        RETURNING id, name
      `, [businessIds])
    } else {
      return NextResponse.json(
        { error: 'Must provide businessIds or set allCustomers=true' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Reset ${result.rowCount} customers for immediate monitoring`,
      customers: result.rows,
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error forcing customer check:', error)
    return NextResponse.json(
      { error: 'Failed to force customer check' },
      { status: 500 }
    )
  }
}
