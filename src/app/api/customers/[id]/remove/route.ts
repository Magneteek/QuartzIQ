/**
 * Remove Customer Status
 * POST /api/customers/[id]/remove
 *
 * Removes customer status and disables monitoring for a business
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Update the business to remove customer status
    const result = await pool.query(
      `UPDATE businesses
       SET
         is_paying_customer = false,
         monitoring_enabled = false,
         lifecycle_stage = 'lead',
         next_monitoring_check = NULL,
         last_updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING name, email`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      )
    }

    const customer = result.rows[0]

    console.log('[Remove Customer] Removed customer status:', {
      id,
      name: customer.name,
      email: customer.email,
    })

    return NextResponse.json({
      success: true,
      message: 'Customer status removed and monitoring disabled',
      customer: {
        name: customer.name,
        email: customer.email,
      },
    })

  } catch (error) {
    console.error('[Remove Customer] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
