/**
 * GHL Webhook: Customer Tagged
 * POST /api/webhooks/ghl/customer-tagged
 *
 * Triggered when a contact is tagged as "customer" in GoHighLevel.
 * Automatically syncs the contact to QuartzIQ and enables monitoring.
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

interface GHLWebhookPayload {
  type: string
  contactId: string
  locationId: string
  tag?: string
  contact?: {
    id: string
    name: string
    email?: string
    phone?: string
    website?: string
    address1?: string
    city?: string
    country?: string
    customField?: Record<string, any>
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret (for security)
    const webhookSecret = process.env.GHL_WEBHOOK_SECRET
    const authHeader = request.headers.get('x-webhook-secret') || request.headers.get('authorization')

    if (webhookSecret && authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      console.error('[GHL Webhook] Unauthorized request')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload: GHLWebhookPayload = await request.json()

    console.log('[GHL Webhook] Received:', {
      type: payload.type,
      contactId: payload.contactId,
      tag: payload.tag,
    })

    // Only process if tagged as "customer" (case-insensitive)
    const customerTags = ['customer', 'paying customer', 'client']
    const isCustomerTag = payload.tag && customerTags.some(
      tag => payload.tag?.toLowerCase().includes(tag.toLowerCase())
    )

    if (!isCustomerTag) {
      return NextResponse.json({
        success: true,
        message: 'Tag not relevant, skipping',
      })
    }

    // Fetch full contact details from GHL if not in payload
    let contact = payload.contact
    if (!contact || !contact.name) {
      contact = await fetchGHLContact(payload.contactId)
    }

    if (!contact || !contact.name) {
      console.error('[GHL Webhook] No contact data available')
      return NextResponse.json(
        { success: false, error: 'No contact data' },
        { status: 400 }
      )
    }

    // Extract custom fields
    const customFields = contact.customField || {}
    const placeId = customFields.place_id || customFields.google_place_id || customFields.placeId
    const businessName = customFields.company_name || customFields.business_name || contact.name
    const category = customFields.category || customFields.niche_category || customFields.industry

    // Check if customer already exists (by place_id or email)
    const existingQuery = placeId
      ? 'SELECT id FROM businesses WHERE place_id = $1'
      : 'SELECT id FROM businesses WHERE email = $1'

    const existingParam = placeId || contact.email

    if (!existingParam) {
      console.error('[GHL Webhook] No unique identifier (place_id or email)')
      return NextResponse.json(
        { success: false, error: 'No unique identifier found' },
        { status: 400 }
      )
    }

    const existing = await pool.query(existingQuery, [existingParam])

    let customerId: string

    if (existing.rows.length > 0) {
      // Update existing customer
      customerId = existing.rows[0].id

      await pool.query(
        `UPDATE businesses
         SET
           lifecycle_stage = 'customer',
           is_paying_customer = true,
           customer_since = COALESCE(customer_since, CURRENT_DATE),
           monitoring_enabled = true,
           monitoring_frequency_hours = COALESCE(monitoring_frequency_hours, 336),
           next_monitoring_check = CASE
             WHEN last_monitoring_check IS NULL THEN CURRENT_TIMESTAMP
             ELSE next_monitoring_check
           END,
           email = COALESCE($1, email),
           phone = COALESCE($2, phone),
           website = COALESCE($3, website),
           address = COALESCE($4, address),
           city = COALESCE($5, city),
           country_code = COALESCE($6, country_code),
           category = COALESCE($7, category),
           last_updated_at = CURRENT_TIMESTAMP,
           ghl_contact_id = $8
         WHERE id = $9`,
        [
          contact.email || null,
          contact.phone || null,
          contact.website || null,
          contact.address1 || null,
          contact.city || null,
          contact.country || null,
          category || null,
          contact.id,
          customerId,
        ]
      )

      console.log('[GHL Webhook] Updated existing customer:', customerId)

    } else {
      // Create new customer
      const result = await pool.query(
        `INSERT INTO businesses (
          name, email, phone, website, address, city, country_code, category, place_id,
          lifecycle_stage, is_paying_customer, customer_since, customer_tier,
          monitoring_enabled, monitoring_frequency_hours, monitoring_alert_threshold,
          next_monitoring_check, ghl_contact_id, data_source, entry_method
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          'customer', true, CURRENT_DATE, 'basic',
          true, 336, 3,
          CURRENT_TIMESTAMP, $10, 'ghl_webhook', 'ghl_webhook'
        )
        RETURNING id`,
        [
          businessName,
          contact.email || null,
          contact.phone || null,
          contact.website || null,
          contact.address1 || null,
          contact.city || null,
          contact.country || null,
          category || null,
          placeId || null,
          contact.id,
        ]
      )

      customerId = result.rows[0].id

      console.log('[GHL Webhook] Created new customer:', customerId)
    }

    return NextResponse.json({
      success: true,
      customerId,
      action: existing.rows.length > 0 ? 'updated' : 'created',
      monitoringEnabled: true,
    })

  } catch (error) {
    console.error('[GHL Webhook] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Fetch contact details from GHL API
 */
async function fetchGHLContact(contactId: string): Promise<any> {
  const ghlApiKey = process.env.GHL_API_KEY

  if (!ghlApiKey) {
    throw new Error('GHL_API_KEY not configured')
  }

  const response = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}`, {
    headers: {
      'Authorization': `Bearer ${ghlApiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`GHL API error: ${response.status}`)
  }

  const data = await response.json()
  return data.contact || data
}
