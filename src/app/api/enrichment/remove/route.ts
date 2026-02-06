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

    // Remove from enrichment queue by setting ready_for_enrichment = false
    // and enrichment_status = null
    const result = await pool.query(
      `UPDATE businesses
       SET ready_for_enrichment = false,
           enrichment_status = null,
           enrichment_priority = 0
       WHERE id = ANY($1::uuid[])
       RETURNING id, name`,
      [businessIds]
    )

    console.log(`✅ Removed ${result.rowCount} businesses from enrichment queue`)

    return NextResponse.json({
      success: true,
      removed: result.rowCount,
      businesses: result.rows
    })

  } catch (error) {
    console.error('Error removing from enrichment queue:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove from enrichment queue',
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
