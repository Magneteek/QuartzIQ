import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { requireRole } from '@/lib/auth-helpers'
import { auth } from '@/auth'
import { z } from 'zod'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

const markCustomerSchema = z.object({
  customerTier: z.enum(['basic', 'premium', 'enterprise']).optional().default('basic'),
  monitoringEnabled: z.boolean().optional().default(true),
  monitoringFrequencyHours: z.number().int().min(24).max(720).optional().default(336), // Default 14 days
  monitoringAlertThreshold: z.number().int().min(1).max(5).optional().default(3), // Alert if ≤3 stars
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['admin', 'va'])
    const session = await auth()

    const { id: businessId } = await params
    const body = await request.json()
    const {
      customerTier,
      monitoringEnabled,
      monitoringFrequencyHours,
      monitoringAlertThreshold,
    } = markCustomerSchema.parse(body)

    // 1. Get current business to verify it exists and get current lifecycle stage
    const businessResult = await pool.query(
      'SELECT id, name, lifecycle_stage FROM businesses WHERE id = $1',
      [businessId]
    )

    if (businessResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    const business = businessResult.rows[0]

    // 2. Verify business is in 'qualified' or 'lead' stage (can only mark qualified/lead as customer)
    if (!['lead', 'qualified'].includes(business.lifecycle_stage)) {
      return NextResponse.json(
        {
          error: 'Business must be in "lead" or "qualified" stage to mark as customer',
          currentStage: business.lifecycle_stage
        },
        { status: 400 }
      )
    }

    // 3. Update business to customer status
    // Note: Set next_monitoring_check to NOW for immediate first check, or NULL to trigger on next monitoring cycle
    const updateResult = await pool.query(
      `UPDATE businesses
       SET
         lifecycle_stage = 'customer',
         lifecycle_updated_at = CURRENT_TIMESTAMP,
         is_paying_customer = true,
         customer_since = COALESCE(customer_since, CURRENT_DATE),
         customer_tier = $1,
         monitoring_enabled = $2,
         monitoring_frequency_hours = $3,
         monitoring_alert_threshold = $4,
         next_monitoring_check = CASE
           WHEN last_monitoring_check IS NULL THEN CURRENT_TIMESTAMP
           ELSE CURRENT_TIMESTAMP + make_interval(hours => $3)
         END,
         last_updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [customerTier, monitoringEnabled, monitoringFrequencyHours, monitoringAlertThreshold, businessId]
    )

    const updatedBusiness = updateResult.rows[0]

    // 4. Log the lifecycle transition
    await pool.query(
      'SELECT log_lead_activity($1, $2, $3, $4, $5, $6)',
      [
        businessId,
        session?.user?.id || null,
        'marked_as_customer',
        JSON.stringify({ old_stage: business.lifecycle_stage }),
        JSON.stringify({
          new_stage: 'customer',
          customer_tier: customerTier,
          monitoring_enabled: monitoringEnabled,
          monitoring_frequency_hours: monitoringFrequencyHours,
        }),
        `Marked as customer (${customerTier} tier)${monitoringEnabled ? ', monitoring enabled' : ''}`,
      ]
    )

    return NextResponse.json({
      success: true,
      message: `Successfully marked "${business.name}" as customer`,
      business: updatedBusiness,
      transition: {
        from: business.lifecycle_stage,
        to: 'customer',
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error marking business as customer:', error)
    return NextResponse.json(
      { error: 'Failed to mark business as customer' },
      { status: 500 }
    )
  }
}
