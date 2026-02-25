import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { requireRoleAPI } from '@/lib/auth-helpers'
import { z } from 'zod'
import { auth } from '@/auth'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

const createBusinessSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  website: z.string().url('Invalid URL').or(z.literal('')).optional(),
  category: z.string().optional(),
  place_id: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  total_reviews: z.number().int().min(0).optional(),
  lifecycle_stage: z.string().default('lead'),
  data_source: z.enum(['manual', 'scraper', 'import']).default('manual'),
  entry_method: z.enum(['manual_entry', 'google_maps_url', 'csv_import']).default('manual_entry'),
  import_status: z.enum(['pending', 'completed', 'failed']).default('pending'),
  google_profile_url: z.string().url('Invalid URL').or(z.literal('')).optional(),
  google_maps_url: z.string().url('Invalid URL').or(z.literal('')).optional(),
  negative_review_url: z.string().url('Invalid URL').or(z.literal('')).optional(),
  va_notes: z.string().optional(),
  enrichment_priority: z.number().int().min(0).max(100).default(50),
})

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireRoleAPI(['admin', 'va'])
    if (error) return error

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '15')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search') || null
    const sortBy = searchParams.get('sortBy') || 'last_qualified_review'
    const sortOrder = searchParams.get('sortOrder') || 'DESC'
    const hasReviews = searchParams.get('hasReviews') === 'true'

    // Advanced filters
    const dateFrom = searchParams.get('dateFrom') || null
    const dateTo = searchParams.get('dateTo') || null
    const ratingMin = searchParams.get('ratingMin') ? parseFloat(searchParams.get('ratingMin')!) : null
    const ratingMax = searchParams.get('ratingMax') ? parseFloat(searchParams.get('ratingMax')!) : null
    const country = searchParams.get('country') || null
    const city = searchParams.get('city') || null
    const reviewsMin = searchParams.get('reviewsMin') ? parseInt(searchParams.get('reviewsMin')!) : null
    const reviewsMax = searchParams.get('reviewsMax') ? parseInt(searchParams.get('reviewsMax')!) : null
    const lifecycleStage = searchParams.get('lifecycleStage') || null
    const dataSource = searchParams.get('dataSource') || null
    const readyForEnrichment = searchParams.get('readyForEnrichment')

    // Build WHERE conditions
    const whereConditions: string[] = []
    const queryParams: any[] = [limit, offset]
    let paramCount = 2

    // Base lifecycle filter
    whereConditions.push(`b.lifecycle_stage IN ('prospect', 'lead')`)

    // Search filter
    if (search) {
      paramCount++
      whereConditions.push(`b.name ILIKE '%' || $${paramCount} || '%'`)
      queryParams.push(search)
    }

    // Date range filter
    if (dateFrom) {
      paramCount++
      whereConditions.push(`b.first_discovered_at >= $${paramCount}`)
      queryParams.push(dateFrom)
    }
    if (dateTo) {
      paramCount++
      whereConditions.push(`b.first_discovered_at <= $${paramCount}`)
      queryParams.push(dateTo + ' 23:59:59')
    }

    // Rating filter
    if (ratingMin !== null) {
      paramCount++
      whereConditions.push(`b.rating >= $${paramCount}`)
      queryParams.push(ratingMin)
    }
    if (ratingMax !== null) {
      paramCount++
      whereConditions.push(`b.rating <= $${paramCount}`)
      queryParams.push(ratingMax)
    }

    // Location filters
    if (country) {
      paramCount++
      whereConditions.push(`b.country_code = $${paramCount}`)
      queryParams.push(country)
    }
    if (city) {
      paramCount++
      whereConditions.push(`b.city ILIKE '%' || $${paramCount} || '%'`)
      queryParams.push(city)
    }

    // Review count filter
    if (reviewsMin !== null) {
      paramCount++
      whereConditions.push(`b.reviews_count >= $${paramCount}`)
      queryParams.push(reviewsMin)
    }
    if (reviewsMax !== null) {
      paramCount++
      whereConditions.push(`b.reviews_count <= $${paramCount}`)
      queryParams.push(reviewsMax)
    }

    // Lifecycle stage filter
    if (lifecycleStage && lifecycleStage !== 'all') {
      paramCount++
      whereConditions.push(`b.lifecycle_stage = $${paramCount}`)
      queryParams.push(lifecycleStage)
      // Remove base lifecycle filter if specific stage selected
      whereConditions[0] = '1=1'
    }

    // Data source filter
    if (dataSource && dataSource !== 'all') {
      paramCount++
      whereConditions.push(`b.data_source = $${paramCount}`)
      queryParams.push(dataSource)
    }

    // Ready for enrichment filter
    if (readyForEnrichment === 'true') {
      whereConditions.push(`b.ready_for_enrichment = true`)
    } else if (readyForEnrichment === 'false') {
      whereConditions.push(`b.ready_for_enrichment = false`)
    }

    const whereClause = whereConditions.join(' AND ')

    // Get leads with optional review filter
    let result
    if (hasReviews) {
      // Map frontend column names to actual database column names
      const columnMap: Record<string, string> = {
        'created_at': 'first_discovered_at',
        'business_name': 'name',
        'rating': 'rating',
        'total_reviews': 'reviews_count',
        'last_qualified_review': 'last_qualified_review_date'
      }

      // Whitelist allowed sort columns for security
      const allowedSortColumns = ['created_at', 'business_name', 'rating', 'total_reviews', 'last_qualified_review']
      const frontendSort = allowedSortColumns.includes(sortBy) ? sortBy : 'last_qualified_review'
      const dbSort = columnMap[frontendSort]
      const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC'

      // Filter to only businesses with qualifying reviews
      result = await pool.query(
        `SELECT
          b.id,
          b.name AS business_name,
          b.first_name,
          b.last_name,
          b.email,
          b.phone,
          b.website,
          b.category,
          b.place_id,
          b.address,
          b.city,
          b.country_code AS country,
          b.rating,
          b.reviews_count AS total_reviews,
          b.lifecycle_stage,
          b.data_source,
          b.qualification_date,
          b.ready_for_enrichment,
          b.import_status,
          b.google_profile_url,
          b.negative_review_url,
          b.va_notes,
          b.first_discovered_at AS created_at,
          b.last_updated_at AS updated_at,
          b.last_qualified_review_date,
          b.qualified_reviews_count,
          b.exported_to_ghl,
          b.exported_to_ghl_at,
          u.name AS qualified_by_name,
          COUNT(r.id)::bigint AS review_count,
          MAX(r.published_date) AS latest_review_date,
          MIN(r.published_date) AS oldest_review_date
        FROM businesses b
        LEFT JOIN users u ON b.qualified_by = u.id
        INNER JOIN reviews r ON r.business_id = b.id
        WHERE ${whereClause}
        GROUP BY b.id, u.name
        HAVING COUNT(r.id) > 0
        ORDER BY b.${dbSort} ${safeSortOrder} NULLS LAST
        LIMIT $1 OFFSET $2`,
        queryParams
      )
    } else {
      // Map frontend column names to actual database column names
      const columnMap: Record<string, string> = {
        'created_at': 'first_discovered_at',
        'business_name': 'name',
        'rating': 'rating',
        'total_reviews': 'reviews_count',
        'last_qualified_review': 'last_qualified_review_date'
      }

      const allowedSortColumns = ['created_at', 'business_name', 'rating', 'total_reviews', 'last_qualified_review']
      const frontendSort = allowedSortColumns.includes(sortBy) ? sortBy : 'last_qualified_review'
      const dbSort = columnMap[frontendSort]
      const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC'

      result = await pool.query(
        `SELECT
          b.id,
          b.name AS business_name,
          b.first_name,
          b.last_name,
          b.email,
          b.phone,
          b.website,
          b.category,
          b.place_id,
          b.address,
          b.city,
          b.country_code AS country,
          b.rating,
          b.reviews_count AS total_reviews,
          b.lifecycle_stage,
          b.data_source,
          b.qualification_date,
          b.ready_for_enrichment,
          b.import_status,
          b.google_profile_url,
          b.negative_review_url,
          b.va_notes,
          b.first_discovered_at AS created_at,
          b.last_updated_at AS updated_at,
          b.last_qualified_review_date,
          b.qualified_reviews_count,
          b.exported_to_ghl,
          b.exported_to_ghl_at,
          u.name AS qualified_by_name,
          COALESCE(
            (SELECT COUNT(*) FROM reviews WHERE business_id = b.id),
            0
          )::bigint AS review_count,
          (SELECT MAX(published_date) FROM reviews WHERE business_id = b.id) AS latest_review_date,
          (SELECT MIN(published_date) FROM reviews WHERE business_id = b.id) AS oldest_review_date
        FROM businesses b
        LEFT JOIN users u ON b.qualified_by = u.id
        WHERE ${whereClause}
        ORDER BY b.${dbSort} ${safeSortOrder} NULLS LAST
        LIMIT $1 OFFSET $2`,
        queryParams
      )
    }

    // Build count query with corrected parameter numbers
    const countWhereConditions: string[] = []
    const countParams: any[] = []
    let countParamIndex = 1

    // Base lifecycle filter
    if (lifecycleStage && lifecycleStage !== 'all') {
      countWhereConditions.push(`b.lifecycle_stage = $${countParamIndex++}`)
      countParams.push(lifecycleStage)
    } else {
      countWhereConditions.push(`b.lifecycle_stage IN ('prospect', 'lead')`)
    }

    // Rebuild filters for count query with new parameter numbering
    if (search) {
      countWhereConditions.push(`b.name ILIKE '%' || $${countParamIndex++} || '%'`)
      countParams.push(search)
    }
    if (dateFrom) {
      countWhereConditions.push(`b.first_discovered_at >= $${countParamIndex++}`)
      countParams.push(dateFrom)
    }
    if (dateTo) {
      countWhereConditions.push(`b.first_discovered_at <= $${countParamIndex++}`)
      countParams.push(dateTo + ' 23:59:59')
    }
    if (ratingMin !== null) {
      countWhereConditions.push(`b.rating >= $${countParamIndex++}`)
      countParams.push(ratingMin)
    }
    if (ratingMax !== null) {
      countWhereConditions.push(`b.rating <= $${countParamIndex++}`)
      countParams.push(ratingMax)
    }
    if (country) {
      countWhereConditions.push(`b.country_code = $${countParamIndex++}`)
      countParams.push(country)
    }
    if (city) {
      countWhereConditions.push(`b.city ILIKE '%' || $${countParamIndex++} || '%'`)
      countParams.push(city)
    }
    if (reviewsMin !== null) {
      countWhereConditions.push(`b.reviews_count >= $${countParamIndex++}`)
      countParams.push(reviewsMin)
    }
    if (reviewsMax !== null) {
      countWhereConditions.push(`b.reviews_count <= $${countParamIndex++}`)
      countParams.push(reviewsMax)
    }
    if (dataSource && dataSource !== 'all') {
      countWhereConditions.push(`b.data_source = $${countParamIndex++}`)
      countParams.push(dataSource)
    }
    if (readyForEnrichment === 'true') {
      countWhereConditions.push(`b.ready_for_enrichment = true`)
    } else if (readyForEnrichment === 'false') {
      countWhereConditions.push(`b.ready_for_enrichment = false`)
    }

    const countWhereClause = countWhereConditions.join(' AND ')

    // Get total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT b.id) as total
       FROM businesses b
       ${hasReviews ? 'INNER JOIN reviews r ON r.business_id = b.id' : ''}
       WHERE ${countWhereClause}
       ${hasReviews ? 'AND r.id IS NOT NULL' : ''}`,
      countParams
    )

    // Get statistics
    const statsResult = await pool.query('SELECT * FROM get_lead_stats()')
    const stats = statsResult.rows[0] || {}

    return NextResponse.json({
      leads: result.rows,
      total: parseInt(countResult.rows[0].total),
      stats: {
        totalLeads: parseInt(stats.total_leads || 0),
        readyForEnrichment: parseInt(stats.ready_for_enrichment || 0),
        addedToday: parseInt(stats.added_today || 0),
        addedThisWeek: parseInt(stats.added_this_week || 0),
        averageRating: parseFloat(stats.average_rating || 0),
      },
    })
  } catch (error: any) {
    console.error('Error fetching leads:', error)
    console.error('Error details:', error.message, error.stack)
    return NextResponse.json(
      {
        error: 'Failed to fetch leads',
        details: error.message,
        sql: error.query
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requireRoleAPI(['admin', 'va'])
    if (error) return error
    const body = await request.json()

    // Ensure business_name is always set for new business
    if (!body.business_name || body.business_name.trim() === '') {
      return NextResponse.json(
        { error: 'Business name is required' },
        { status: 400 }
      )
    }

    const validatedData = createBusinessSchema.parse(body)

    // Generate placeholder place_id if not provided (required field)
    const placeId = validatedData.place_id || `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Check for existing business with same place_id
    if (validatedData.place_id) {
      const existingBusiness = await pool.query(
        'SELECT id, name, lifecycle_stage FROM businesses WHERE place_id = $1',
        [validatedData.place_id]
      )

      if (existingBusiness.rows.length > 0) {
        const existing = existingBusiness.rows[0]
        return NextResponse.json(
          {
            error: 'Business already exists',
            details: `A business with this Google Maps location already exists: "${existing.name}" (${existing.lifecycle_stage} stage)`,
            existingBusinessId: existing.id,
            isDuplicate: true,
          },
          { status: 409 } // 409 Conflict
        )
      }
    }

    // Check for existing business with similar name (fuzzy match)
    const similarBusinesses = await pool.query(
      `SELECT id, name, place_id, lifecycle_stage
       FROM businesses
       WHERE LOWER(name) = LOWER($1)
       LIMIT 1`,
      [validatedData.business_name]
    )

    if (similarBusinesses.rows.length > 0) {
      const similar = similarBusinesses.rows[0]
      return NextResponse.json(
        {
          error: 'Similar business exists',
          details: `A business with a very similar name already exists: "${similar.name}" (${similar.lifecycle_stage} stage)`,
          suggestion: 'This might be a duplicate. Please check the existing business or use a more specific name.',
          existingBusinessId: similar.id,
          isDuplicate: true,
        },
        { status: 409 } // 409 Conflict
      )
    }

    // Insert business - database column names differ from API field names
    const result = await pool.query(
      `INSERT INTO businesses (
        name,
        first_name,
        last_name,
        email,
        phone,
        website,
        category,
        place_id,
        address,
        city,
        country_code,
        rating,
        reviews_count,
        lifecycle_stage,
        data_source,
        entry_method,
        import_status,
        google_profile_url,
        google_maps_url,
        negative_review_url,
        va_notes,
        enrichment_priority,
        qualification_date,
        qualified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, CURRENT_TIMESTAMP, $23)
      RETURNING *`,
      [
        validatedData.business_name, // Maps to 'name' column
        validatedData.first_name || null,
        validatedData.last_name || null,
        validatedData.email || null,
        validatedData.phone || null,
        validatedData.website || null,
        validatedData.category || null,
        placeId, // Generated placeholder if not provided
        validatedData.address || null,
        validatedData.city || null,
        validatedData.country || null, // Maps to 'country_code' column
        validatedData.rating || null,
        validatedData.total_reviews || null, // Maps to 'reviews_count' column
        validatedData.lifecycle_stage,
        validatedData.data_source,
        validatedData.entry_method,
        validatedData.import_status,
        validatedData.google_profile_url || null,
        validatedData.google_maps_url || validatedData.google_profile_url || null, // Use google_profile_url as fallback
        validatedData.negative_review_url || null,
        validatedData.va_notes || null,
        validatedData.enrichment_priority,
        session?.user?.id || null,
      ]
    )

    const newBusiness = result.rows[0]

    // Log activity
    await pool.query(
      'SELECT log_lead_activity($1, $2, $3, $4, $5, $6)',
      [
        newBusiness.id,
        session?.user?.id || null,
        'created',
        null,
        JSON.stringify(newBusiness),
        `Business created via ${validatedData.entry_method}`,
      ]
    )

    return NextResponse.json(
      { business: newBusiness },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    // Handle PostgreSQL constraint violations
    if (error.code === '23505') {
      // Unique constraint violation
      const constraintMatch = error.detail?.match(/Key \((.*?)\)=\((.*?)\) already exists/)
      const field = constraintMatch?.[1] || 'unknown field'
      const value = constraintMatch?.[2] || 'unknown value'

      return NextResponse.json(
        {
          error: 'Duplicate business',
          details: `A business with this ${field} already exists in the database.`,
          isDuplicate: true,
        },
        { status: 409 }
      )
    }

    if (error.code === '23503') {
      // Foreign key constraint violation
      return NextResponse.json(
        {
          error: 'Invalid reference',
          details: 'One or more referenced records do not exist.',
        },
        { status: 400 }
      )
    }

    console.error('Error creating business:', error)
    console.error('Error code:', error.code)
    console.error('Error detail:', error.detail)
    return NextResponse.json(
      {
        error: 'Failed to create business',
        details: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
