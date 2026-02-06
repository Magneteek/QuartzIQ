import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { requireRoleAPI } from '@/lib/auth-helpers'
import { z } from 'zod'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

const customerConversionSchema = z.object({
  business_id: z.string().uuid(),
  customer_tier: z.enum(['basic', 'premium', 'enterprise']),
  monitoring_enabled: z.boolean().default(true),
  monitoring_frequency_hours: z.number().int().min(1).max(168).default(24),
  monitoring_alert_threshold: z.number().int().min(1).max(5).default(3),
})

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireRoleAPI(['admin', 'va', 'enrichment'])
    if (error) return error

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search') || null
    const sortBy = searchParams.get('sortBy') || 'customer_since'
    const sortOrder = searchParams.get('sortOrder') || 'DESC'
    const tier = searchParams.get('tier') || 'all'
    const monitoringStatus = searchParams.get('monitoring') || 'all'

    // Build filters
    let tierFilter = ''
    if (tier !== 'all') {
      tierFilter = `AND b.customer_tier = '${tier}'`
    }

    let monitoringFilter = ''
    if (monitoringStatus === 'enabled') {
      monitoringFilter = 'AND b.monitoring_enabled = TRUE'
    } else if (monitoringStatus === 'disabled') {
      monitoringFilter = 'AND b.monitoring_enabled = FALSE'
    }

    const query = `
      SELECT
        b.id,
        CAST(b.name AS TEXT) AS business_name,
        CAST(b.first_name AS TEXT) AS first_name,
        CAST(b.last_name AS TEXT) AS last_name,
        CAST(b.email AS TEXT) AS email,
        CAST(b.phone AS TEXT) AS phone,
        CAST(b.website AS TEXT) AS website,
        CAST(b.category AS TEXT) AS category,
        CAST(b.address AS TEXT) AS address,
        CAST(b.city AS TEXT) AS city,
        CAST(b.country_code AS TEXT) AS country,
        b.rating,
        b.reviews_count AS total_reviews,
        CAST(b.customer_tier AS TEXT) AS customer_tier,
        b.customer_since,
        b.monitoring_enabled,
        b.monitoring_frequency_hours,
        b.monitoring_alert_threshold,
        b.last_monitoring_check,
        b.next_monitoring_check,
        b.total_removed_reviews,
        CAST(b.notes AS TEXT) AS notes,
        COUNT(DISTINCT r.id) AS review_count,
        COUNT(DISTINCT cma.id) FILTER (WHERE cma.acknowledged_at IS NULL) AS unacknowledged_alerts,
        MAX(cma.detected_at) AS latest_alert_date,
        b.first_discovered_at AS created_at,
        b.last_updated_at AS updated_at
      FROM businesses b
      LEFT JOIN reviews r ON b.id = r.business_id
      LEFT JOIN customer_monitoring_alerts cma ON b.id = cma.business_id
      WHERE b.is_paying_customer = TRUE
        ${tierFilter}
        ${monitoringFilter}
        AND ($1::text IS NULL OR
             b.name ILIKE '%' || $1 || '%' OR
             b.email ILIKE '%' || $1 || '%' OR
             b.phone ILIKE '%' || $1 || '%')
      GROUP BY b.id
      ORDER BY
        CASE WHEN $2 = 'business_name' AND $3 = 'ASC' THEN b.name END ASC,
        CASE WHEN $2 = 'business_name' AND $3 = 'DESC' THEN b.name END DESC,
        CASE WHEN $2 = 'customer_since' AND $3 = 'ASC' THEN b.customer_since END ASC,
        CASE WHEN $2 = 'customer_since' AND $3 = 'DESC' THEN b.customer_since END DESC,
        CASE WHEN $2 = 'tier' AND $3 = 'ASC' THEN b.customer_tier END ASC,
        CASE WHEN $2 = 'tier' AND $3 = 'DESC' THEN b.customer_tier END DESC,
        CASE WHEN $2 = 'total_removed' AND $3 = 'ASC' THEN b.total_removed_reviews END ASC,
        CASE WHEN $2 = 'total_removed' AND $3 = 'DESC' THEN b.total_removed_reviews END DESC
      LIMIT $4 OFFSET $5
    `

    const result = await pool.query(query, [search, sortBy, sortOrder, limit, offset])

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM businesses b
      WHERE b.is_paying_customer = TRUE
        ${tierFilter}
        ${monitoringFilter}
        AND ($1::text IS NULL OR b.name ILIKE '%' || $1 || '%')
    `
    const countResult = await pool.query(countQuery, [search])

    // Get statistics
    const statsQuery = `
      SELECT
        COUNT(*)::INTEGER AS total_customers,
        COUNT(*) FILTER (WHERE customer_tier = 'basic')::INTEGER AS basic_tier,
        COUNT(*) FILTER (WHERE customer_tier = 'premium')::INTEGER AS premium_tier,
        COUNT(*) FILTER (WHERE customer_tier = 'enterprise')::INTEGER AS enterprise_tier,
        COUNT(*) FILTER (WHERE monitoring_enabled = TRUE)::INTEGER AS monitoring_enabled,
        COUNT(*) FILTER (WHERE customer_since >= CURRENT_DATE - INTERVAL '30 days')::INTEGER AS new_this_month,
        SUM(total_removed_reviews)::INTEGER AS total_removals,
        AVG(rating) AS avg_rating
      FROM businesses
      WHERE is_paying_customer = TRUE
    `
    const statsResult = await pool.query(statsQuery)
    const stats = statsResult.rows[0] || {}

    return NextResponse.json({
      customers: result.rows,
      total: parseInt(countResult.rows[0].total),
      stats: {
        totalCustomers: parseInt(stats.total_customers || 0),
        basicTier: parseInt(stats.basic_tier || 0),
        premiumTier: parseInt(stats.premium_tier || 0),
        enterpriseTier: parseInt(stats.enterprise_tier || 0),
        monitoringEnabled: parseInt(stats.monitoring_enabled || 0),
        newThisMonth: parseInt(stats.new_this_month || 0),
        totalRemovals: parseInt(stats.total_removals || 0),
        avgRating: parseFloat(stats.avg_rating || 0),
      },
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}

// Convert qualified lead to paying customer
export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requireRoleAPI(['admin'])
    if (error) return error

    const body = await request.json()
    const validatedData = customerConversionSchema.parse(body)

    // Update business to customer status
    const result = await pool.query(
      `UPDATE businesses
       SET is_paying_customer = TRUE,
           customer_since = CURRENT_DATE,
           customer_tier = $1,
           monitoring_enabled = $2,
           monitoring_frequency_hours = $3,
           monitoring_alert_threshold = $4,
           lifecycle_stage = 'customer',
           lifecycle_updated_at = CURRENT_TIMESTAMP,
           next_monitoring_check = CURRENT_TIMESTAMP + ($3 || ' hours')::INTERVAL
       WHERE id = $5
       RETURNING *`,
      [
        validatedData.customer_tier,
        validatedData.monitoring_enabled,
        validatedData.monitoring_frequency_hours,
        validatedData.monitoring_alert_threshold,
        validatedData.business_id,
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    const customer = result.rows[0]

    // Log activity
    await pool.query(
      'SELECT log_lead_activity($1, $2, $3, $4, $5, $6)',
      [
        validatedData.business_id,
        session?.user?.id || null,
        'converted_to_customer',
        null,
        JSON.stringify(customer),
        `Converted to ${validatedData.customer_tier} tier customer with monitoring ${
          validatedData.monitoring_enabled ? 'enabled' : 'disabled'
        }`,
      ]
    )

    return NextResponse.json(
      { customer, message: 'Successfully converted to customer' },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error converting to customer:', error)
    return NextResponse.json(
      { error: 'Failed to convert to customer' },
      { status: 500 }
    )
  }
}
