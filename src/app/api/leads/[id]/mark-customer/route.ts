import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { requireRole } from '@/lib/auth-helpers'
import { auth } from '@/auth'
import { z } from 'zod'

const GHL_API_BASE = 'https://services.leadconnectorhq.com'
const GHL_API_KEY = process.env.GHL_API_KEY
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID

async function syncToGHL(business: Record<string, unknown>): Promise<string | null> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) return null

  const headers = {
    'Authorization': `Bearer ${GHL_API_KEY}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  }

  // Only pass real place_ids (not ghl_ placeholders)
  const realPlaceId = business.place_id && !(business.place_id as string).startsWith('ghl_')
    ? business.place_id as string
    : null

  try {
    let ghlContactId = business.ghl_contact_id as string | null

    // If we already have a GHL contact ID, just add the tag
    if (ghlContactId) {
      await fetch(`${GHL_API_BASE}/contacts/${ghlContactId}/tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tags: ['customer'] }),
      })
      console.log('[GHL Sync] Tagged existing contact:', ghlContactId)
      return ghlContactId
    }

    // Search GHL by email
    if (business.email) {
      const searchRes = await fetch(
        `${GHL_API_BASE}/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(business.email as string)}`,
        { headers }
      )
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        ghlContactId = searchData.contact?.id || null
      }
    }

    // Search GHL by phone if email didn't match
    if (!ghlContactId && business.phone) {
      const searchRes = await fetch(
        `${GHL_API_BASE}/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&phone=${encodeURIComponent(business.phone as string)}`,
        { headers }
      )
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        ghlContactId = searchData.contact?.id || null
      }
    }

    if (ghlContactId) {
      // Found in GHL — add tag
      await fetch(`${GHL_API_BASE}/contacts/${ghlContactId}/tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tags: ['customer'] }),
      })
      console.log('[GHL Sync] Found and tagged contact:', ghlContactId)
    } else {
      // Not in GHL — create new contact
      const createRes = await fetch(`${GHL_API_BASE}/contacts/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          locationId: GHL_LOCATION_ID,
          companyName: business.name,
          name: business.name,
          email: business.email || undefined,
          phone: business.phone || undefined,
          website: business.website || undefined,
          tags: ['customer'],
          customFields: [
            ...(realPlaceId ? [{ key: 'place_id', field_value: realPlaceId }] : []),
            ...(business.google_maps_url ? [{ key: 'google_url', field_value: business.google_maps_url }] : []),
            ...(business.category ? [{ key: 'niche__category', field_value: business.category }] : []),
          ],
        }),
      })
      if (createRes.ok) {
        const createData = await createRes.json()
        ghlContactId = createData.contact?.id || null
        console.log('[GHL Sync] Created new contact:', ghlContactId)
      } else {
        const errText = await createRes.text()
        console.error('[GHL Sync] Create failed:', createRes.status, errText.slice(0, 200))
      }
    }

    return ghlContactId
  } catch (err) {
    console.error('[GHL Sync] Failed:', err)
    return null
  }
}

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
      `SELECT id, name, lifecycle_stage, email, phone, website, category,
              place_id, google_maps_url, ghl_contact_id
       FROM businesses WHERE id = $1`,
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

    // 5. Sync to GHL — fire and forget, don't fail the request if GHL is down
    let ghlContactId: string | null = null
    try {
      ghlContactId = await syncToGHL(business)
      if (ghlContactId && ghlContactId !== business.ghl_contact_id) {
        await pool.query(
          'UPDATE businesses SET ghl_contact_id = $1 WHERE id = $2',
          [ghlContactId, businessId]
        )
      }
    } catch (err) {
      console.error('[GHL Sync] Non-fatal error:', err)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully marked "${business.name}" as customer`,
      business: updatedBusiness,
      ghlSynced: !!ghlContactId,
      ghlContactId,
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
