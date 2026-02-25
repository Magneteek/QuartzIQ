import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

interface QueueBusiness {
  title: string
  address: string
  phone?: string
  email?: string
  website?: string
  placeId: string
  url?: string
  category?: string
  totalScore?: number
  reviewsCount?: number
  city?: string
  countryCode?: string
}

interface QueueRequest {
  businesses: QueueBusiness[]
  autoEnrich?: boolean // Default: true
}

/**
 * POST /api/leads/queue-for-enrichment
 * Saves businesses from discovery to database and queues for enrichment
 */
export async function POST(request: NextRequest) {
  try {
    const body: QueueRequest = await request.json()
    const { businesses, autoEnrich = true } = body

    if (!businesses || businesses.length === 0) {
      return NextResponse.json(
        { error: 'No businesses provided' },
        { status: 400 }
      )
    }

    const results: { success: boolean; businessId?: string; businessName: string; error?: string }[] = []

    for (const business of businesses) {
      try {
        // Check if business already exists
        const existingCheck = await pool.query(
          'SELECT id, name, lifecycle_stage, ready_for_enrichment FROM businesses WHERE place_id = $1',
          [business.placeId]
        )

        if (existingCheck.rows.length > 0) {
          const existing = existingCheck.rows[0]

          // Update existing business with NEW qualifying review
          // Always update last_qualified_review_date to move to top of list
          await pool.query(
            `UPDATE businesses
             SET ready_for_enrichment = CASE
               WHEN $2 = true THEN true
               ELSE ready_for_enrichment
             END,
             enrichment_priority = CASE
               WHEN $2 = true AND ready_for_enrichment = false THEN 50
               ELSE enrichment_priority
             END,
             lifecycle_stage = CASE
               WHEN lifecycle_stage = 'prospect' THEN 'lead'
               ELSE lifecycle_stage
             END,
             last_qualified_review_date = NOW(),
             qualified_reviews_count = qualified_reviews_count + 1,
             last_review_check_date = NOW(),
             updated_at = NOW()
             WHERE id = $1`,
            [existing.id, autoEnrich]
          )

          results.push({
            success: true,
            businessId: existing.id,
            businessName: existing.name,
            error: `Already exists (updated for enrichment)`
          })
          continue
        }

        // Insert new business
        const insertResult = await pool.query(
          `INSERT INTO businesses (
            name,
            place_id,
            address,
            city,
            country_code,
            phone,
            email_enriched,
            website,
            google_maps_url,
            category,
            rating,
            reviews_count,
            lifecycle_stage,
            data_source,
            entry_method,
            ready_for_enrichment,
            enrichment_priority,
            first_discovered_at,
            last_qualified_review_date,
            qualified_reviews_count,
            last_review_check_date
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW(), 1, NOW()
          ) RETURNING id, name`,
          [
            business.title,
            business.placeId,
            business.address,
            business.city || null,
            business.countryCode || 'nl',
            business.phone || null,
            business.email || null,
            business.website || null,
            business.url || null,
            business.category || null,
            business.totalScore || null,
            business.reviewsCount || 0,
            'lead', // Always start as 'lead'
            'scraper', // From discovery
            'google_maps_discovery',
            autoEnrich, // Queue for enrichment
            50, // Default priority
          ]
        )

        const newBusiness = insertResult.rows[0]

        results.push({
          success: true,
          businessId: newBusiness.id,
          businessName: newBusiness.name
        })

      } catch (error: any) {
        console.error(`Failed to save business ${business.title}:`, error)
        results.push({
          success: false,
          businessName: business.title,
          error: error.message
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const errorCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Saved ${successCount} businesses${autoEnrich ? ' and queued for enrichment' : ''}`,
      saved: successCount,
      errors: errorCount,
      results
    })

  } catch (error: any) {
    console.error('Queue for enrichment error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to queue businesses' },
      { status: 500 }
    )
  }
}
