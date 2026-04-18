/**
 * GHL Webhook: Customer Tagged
 * POST /api/webhooks/ghl/customer-tagged
 *
 * Triggered when a contact in GHL is tagged "customer".
 * Matches against businesses table by: place_id → google_maps_url → email → company_name
 * If no match, creates a new record using all available GHL data.
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

/** GHL sends literal string "null" when template field is empty — treat as null */
function sanitize(val: unknown): string | null {
  if (!val || val === 'null' || val === 'undefined' || (typeof val === 'string' && val.trim() === '')) return null
  return String(val).trim()
}

/** Only accept URLs that look like Google Maps */
function sanitizeGoogleUrl(val: unknown): string | null {
  const s = sanitize(val)
  if (!s) return null
  if (s.includes('google.com/maps') || s.includes('maps.google') || s.includes('goo.gl/maps')) return s
  return null
}

/** Extract Google place_id from a Maps URL if possible */
function extractPlaceIdFromUrl(url: string): string | null {
  if (!url) return null
  // Format: ...!1sChIJ... (place_id in data segment)
  const match = url.match(/!1s(ChIJ[^!]+)/)
  if (match) return decodeURIComponent(match[1])
  return null
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const webhookSecret = process.env.GHL_WEBHOOK_SECRET
    const authHeader = request.headers.get('x-webhook-secret') || request.headers.get('authorization')

    if (webhookSecret && authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      console.error('[GHL Webhook] Unauthorized request')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await request.json()
    console.log('[GHL Webhook] FULL PAYLOAD:', JSON.stringify(payload, null, 2))

    // Extract all available fields from GHL payload — sanitize "null" strings GHL sends for empty fields
    const contactId      = sanitize(payload.contactId || payload.contact_id || payload.id)
    const firstName      = sanitize(payload.firstName || payload.first_name || payload.contact?.firstName)
    const lastName       = sanitize(payload.lastName || payload.last_name || payload.contact?.lastName)
    const companyName    = sanitize(payload.companyName || payload.company_name || payload.contact?.companyName)
    const contactEmail   = sanitize(payload.email || payload.contact?.email)
    const contactPhone   = sanitize(payload.phone || payload.contact?.phone)
    const contactWebsite = sanitize(payload.website || payload.contact?.website)
    const contactCategory = sanitize(payload.category || payload.niche__category)

    // Place ID: direct field or extracted from Google Maps URL
    let placeId = sanitize(payload.placeId || payload.place_id || payload.customFields?.place_id)
    const googleMapsUrl = sanitizeGoogleUrl(payload.googleMapsUrl || payload.google_url || payload.customFields?.google_url)
    if (!placeId && googleMapsUrl) {
      placeId = extractPlaceIdFromUrl(googleMapsUrl)
      if (placeId) console.log('[GHL Webhook] Extracted place_id from Maps URL:', placeId)
    }

    // Best name to use: company name preferred over contact name
    const personName = [firstName, lastName].filter(Boolean).join(' ').trim() || null
    const businessName = companyName || personName

    console.log('[GHL Webhook] Extracted:', { contactId, businessName, companyName, personName, contactEmail, placeId, googleMapsUrl })

    if (!businessName && !contactEmail && !placeId) {
      return NextResponse.json({
        success: false,
        error: 'No identifiable data found (need at least: companyName, email, or placeId)',
        receivedPayload: payload,
      }, { status: 400 })
    }

    // Match priority: place_id → email → company name
    let existingId: string | null = null
    let matchedBy: string | null = null

    if (placeId) {
      const result = await pool.query('SELECT id FROM businesses WHERE place_id = $1', [placeId])
      if (result.rows.length > 0) { existingId = result.rows[0].id; matchedBy = 'place_id' }
    }

    if (!existingId && contactEmail) {
      const result = await pool.query('SELECT id FROM businesses WHERE email = $1', [contactEmail])
      if (result.rows.length > 0) { existingId = result.rows[0].id; matchedBy = 'email' }
    }

    if (!existingId && companyName) {
      const result = await pool.query(
        'SELECT id FROM businesses WHERE LOWER(name) = LOWER($1) LIMIT 1',
        [companyName]
      )
      if (result.rows.length > 0) { existingId = result.rows[0].id; matchedBy = 'company_name' }
    }

    let customerId: string
    let action: string

    if (existingId) {
      customerId = existingId
      action = 'updated'

      // Update monitoring flags + sync all available GHL data
      await pool.query(
        `UPDATE businesses SET
          lifecycle_stage = 'customer',
          is_paying_customer = true,
          customer_since = COALESCE(customer_since, CURRENT_DATE),
          monitoring_enabled = true,
          monitoring_frequency_hours = COALESCE(monitoring_frequency_hours, 336),
          next_monitoring_check = CURRENT_TIMESTAMP,
          last_updated_at = CURRENT_TIMESTAMP,
          name = COALESCE($2, name),
          first_name = COALESCE($3, first_name),
          last_name = COALESCE($4, last_name),
          place_id = COALESCE(place_id, $5),
          google_maps_url = COALESCE(google_maps_url, $6),
          email = COALESCE(email, $7),
          phone = COALESCE(phone, $8),
          website = COALESCE(website, $9),
          category = COALESCE(category, $10),
          ghl_contact_id = COALESCE(ghl_contact_id, $11)
        WHERE id = $1`,
        [customerId, companyName, firstName || null, lastName || null, placeId, googleMapsUrl, contactEmail, contactPhone, contactWebsite, contactCategory, contactId || null]
      )
      console.log(`[GHL Webhook] Updated existing customer (matched by ${matchedBy}):`, customerId)

    } else if (businessName) {
      // Create new record with all available data
      const result = await pool.query(
        `INSERT INTO businesses (
          name, email, phone, website, place_id, google_maps_url, category,
          lifecycle_stage, is_paying_customer, customer_since,
          monitoring_enabled, monitoring_frequency_hours, monitoring_alert_threshold,
          next_monitoring_check, data_source, ghl_contact_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          'customer', true, CURRENT_DATE,
          true, 336, 3,
          CURRENT_TIMESTAMP, 'ghl_webhook', $8
        ) RETURNING id`,
        [businessName, contactEmail, contactPhone, contactWebsite, placeId, googleMapsUrl, contactCategory, contactId || null]
      )
      customerId = result.rows[0].id
      action = 'created'
      console.log('[GHL Webhook] Created new customer:', customerId, businessName)

    } else {
      return NextResponse.json({
        success: false,
        error: 'Could not identify or create customer record',
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      customerId,
      action,
      matchedBy: matchedBy || 'none',
      monitoringEnabled: true,
      businessName,
    })

  } catch (error) {
    console.error('[GHL Webhook] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
