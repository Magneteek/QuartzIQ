  /**                                                                                                                       
   * GHL Webhook: Customer Tagged                                                                                             
   * POST /api/webhooks/ghl/customer-tagged                                                                                 
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

  export async function POST(request: NextRequest) {
    try {
      // Verify webhook secret
      const webhookSecret = process.env.GHL_WEBHOOK_SECRET
      const authHeader = request.headers.get('x-webhook-secret') || request.headers.get('authorization')

      if (webhookSecret && authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
        console.error('[GHL Webhook] Unauthorized request')
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      // Log the FULL raw payload to see what GHL sends
      const payload = await request.json()
      console.log('[GHL Webhook] FULL PAYLOAD:', JSON.stringify(payload, null, 2))

      // Try to extract data from various possible GHL formats
      const contactId = payload.contactId || payload.contact_id || payload.id || payload.contact?.id
      const contactName = payload.name || payload.contact?.name || payload.full_name || payload.firstName
      const contactEmail = payload.email || payload.contact?.email
      const tags = payload.tags || payload.tag || payload.contact?.tags
      const placeId = payload.place_id || payload.customFields?.place_id || payload.customField?.place_id

      console.log('[GHL Webhook] Extracted:', { contactId, contactName, contactEmail, tags, placeId })

      // For now, just accept the webhook and create/update the customer
      if (!contactName && !contactEmail && !placeId) {
        return NextResponse.json({
          success: false,
          error: 'No identifiable data found',
          receivedPayload: payload,
        }, { status: 400 })
      }

      // Check if exists by place_id first, then email
      let existingId: string | null = null

      if (placeId) {
        const result = await pool.query('SELECT id FROM businesses WHERE place_id = $1', [placeId])
        if (result.rows.length > 0) {
          existingId = result.rows[0].id
        }
      }

      if (!existingId && contactEmail) {
        const result = await pool.query('SELECT id FROM businesses WHERE email = $1', [contactEmail])
        if (result.rows.length > 0) {
          existingId = result.rows[0].id
        }
      }

      let customerId: string

      if (existingId) {
        // Update existing
        customerId = existingId
        await pool.query(
          `UPDATE businesses SET
            lifecycle_stage = 'customer',
            is_paying_customer = true,
            customer_since = COALESCE(customer_since, CURRENT_DATE),
            monitoring_enabled = true,
            monitoring_frequency_hours = COALESCE(monitoring_frequency_hours, 336),
            next_monitoring_check = CURRENT_TIMESTAMP,
            last_updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
          [customerId]
        )
        console.log('[GHL Webhook] Updated existing customer:', customerId)
      } else if (contactName) {
        // Create new
        const result = await pool.query(
          `INSERT INTO businesses (
            name, email, place_id, lifecycle_stage, is_paying_customer, customer_since,
            monitoring_enabled, monitoring_frequency_hours, monitoring_alert_threshold,
            next_monitoring_check, data_source, entry_method
          ) VALUES ($1, $2, $3, 'customer', true, CURRENT_DATE, true, 336, 3, CURRENT_TIMESTAMP, 'ghl_webhook', 'ghl_webhook')
          RETURNING id`,
          [contactName, contactEmail || null, placeId || null]
        )
        customerId = result.rows[0].id
        console.log('[GHL Webhook] Created new customer:', customerId)
      } else {
        return NextResponse.json({
          success: false,
          error: 'Could not create or update customer',
        }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        customerId,
        action: existingId ? 'updated' : 'created',
        monitoringEnabled: true,
      })

    } catch (error) {
      console.error('[GHL Webhook] Error:', error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 })
    }
  }

