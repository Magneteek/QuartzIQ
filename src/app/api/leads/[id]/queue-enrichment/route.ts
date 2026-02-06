import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { requireRole } from '@/lib/auth-helpers'
import { auth } from '@/auth'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

/**
 * Queue a lead for enrichment (Import to Quartz)
 *
 * This endpoint:
 * 1. Moves the business from 'lead' to 'qualified' lifecycle stage
 * 2. Marks it as ready_for_enrichment = true
 * 3. Adds it to the enrichment_queue for async processing
 * 4. Logs the activity
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[Queue Enrichment] Starting...')

    await requireRole(['admin', 'va'])
    const { id } = await params
    console.log('[Queue Enrichment] Business ID:', id)

    const session = await auth()
    console.log('[Queue Enrichment] Session user:', session?.user?.id)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Get user's organization_id
    console.log('[Queue Enrichment] Fetching user organization...')
    const userResult = await pool.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [session.user.id]
    )

    console.log('[Queue Enrichment] User result:', userResult.rows[0])

    if (userResult.rows.length === 0 || !userResult.rows[0].organization_id) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 400 }
      )
    }

    const organizationId = userResult.rows[0].organization_id
    console.log('[Queue Enrichment] Organization ID:', organizationId)

    // Get current business data
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

    const business = businessResult.rows[0]

    // Check if already queued for enrichment OR if recently processed
    const existingQueue = await pool.query(
      `SELECT id, status FROM enrichment_queue
       WHERE business_id = $1
       AND (
         status IN ('queued', 'processing')
         OR (status = 'completed' AND completed_at > NOW() - INTERVAL '1 hour')
       )
       ORDER BY queued_at DESC
       LIMIT 1`,
      [id]
    )

    if (existingQueue.rows.length > 0) {
      const status = existingQueue.rows[0].status
      if (status === 'completed') {
        return NextResponse.json(
          {
            error: 'Business was recently enriched (within last hour)',
            queueStatus: status
          },
          { status: 400 }
        )
      }
      return NextResponse.json(
        {
          error: 'Business is already queued for enrichment',
          queueStatus: status
        },
        { status: 400 }
      )
    }

    // Start transaction
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Update business lifecycle stage and enrichment readiness
      const updateResult = await client.query(
        `UPDATE businesses
         SET lifecycle_stage = 'qualified',
             lifecycle_updated_at = CURRENT_TIMESTAMP,
             ready_for_enrichment = true,
             enrichment_priority = COALESCE(enrichment_priority, 50),
             last_updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id]
      )

      const updatedBusiness = updateResult.rows[0]

      // 2. Add to enrichment queue
      const queueResult = await client.query(
        `INSERT INTO enrichment_queue (
          organization_id,
          business_id,
          priority,
          target_executive_count,
          enrichment_config,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          organizationId,
          id,
          business.enrichment_priority || 50,
          1, // Default: find 1 executive per business
          JSON.stringify({
            method: 'auto', // Try Claude first, then Apollo if needed
            reveal_personal_emails: true,
            reveal_phone_number: true,
          }),
          'queued',
        ]
      )

      const queueItem = queueResult.rows[0]

      // 3. Log activity
      await client.query(
        'SELECT log_lead_activity($1, $2, $3, $4, $5, $6)',
        [
          id,
          session.user.id,
          'queued_for_enrichment',
          JSON.stringify(business),
          JSON.stringify(updatedBusiness),
          `Lead queued for enrichment (Import to Quartz). Queue ID: ${queueItem.id}`,
        ]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Lead successfully queued for enrichment',
        business: updatedBusiness,
        queueItem: {
          id: queueItem.id,
          status: queueItem.status,
          priority: queueItem.priority,
          queuedAt: queueItem.queued_at,
        },
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('[Queue Enrichment] Error:', error)
    console.error('[Queue Enrichment] Error code:', error.code)
    console.error('[Queue Enrichment] Error details:', error.detail)
    return NextResponse.json(
      {
        error: 'Failed to queue lead for enrichment',
        details: error.message || String(error),
        code: error.code,
        hint: error.code === '23503' ? 'Database foreign key constraint error - check if organization or user exists' : undefined
      },
      { status: 500 }
    )
  }
}
