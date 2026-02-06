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

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireRoleAPI(['admin', 'enrichment'])
    if (error) return error

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '15')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search') || null
    const sortBy = searchParams.get('sortBy') || 'qualification_date'
    const sortOrder = searchParams.get('sortOrder') || 'DESC'
    const status = searchParams.get('status') || 'all' // 'all', 'pending', 'in_progress', 'completed'

    // Build status filter
    let statusFilter = ''
    if (status === 'pending') {
      statusFilter = "AND b.enrichment_status = 'pending'"
    } else if (status === 'in_progress') {
      statusFilter = "AND b.enrichment_status = 'in_progress'"
    } else if (status === 'completed') {
      statusFilter = "AND b.enrichment_status = 'completed'"
    }

    // Get leads ready for enrichment
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
        CAST(b.place_id AS TEXT) AS place_id,
        CAST(b.address AS TEXT) AS address,
        CAST(b.city AS TEXT) AS city,
        CAST(b.country_code AS TEXT) AS country,
        b.rating,
        b.reviews_count AS total_reviews,
        CAST(b.lifecycle_stage AS TEXT) AS lifecycle_stage,
        CAST(b.enrichment_status AS TEXT) AS enrichment_status,
        b.enrichment_priority,
        b.enrichment_confidence,
        b.qualification_date,
        b.enrichment_started_at,
        b.enrichment_completed_at,
        CAST(qualified_user.name AS TEXT) AS qualified_by_name,
        CAST(enriched_user.name AS TEXT) AS enriched_by_name,
        b.va_notes,
        COUNT(r.id) AS review_count,
        MAX(r.published_date) AS latest_review_date,
        b.first_discovered_at AS created_at,
        b.last_updated_at AS updated_at
      FROM businesses b
      LEFT JOIN users qualified_user ON b.qualified_by = qualified_user.id
      LEFT JOIN users enriched_user ON b.enriched_by = enriched_user.id
      LEFT JOIN reviews r ON b.id = r.business_id
      WHERE b.ready_for_enrichment = TRUE
        AND b.lifecycle_stage IN ('lead', 'qualified')
        ${statusFilter}
        AND ($1::text IS NULL OR
             b.name ILIKE '%' || $1 || '%' OR
             b.email ILIKE '%' || $1 || '%' OR
             b.phone ILIKE '%' || $1 || '%')
      GROUP BY b.id, qualified_user.name, enriched_user.name
      ORDER BY
        CASE WHEN $2 = 'business_name' AND $3 = 'ASC' THEN b.name END ASC,
        CASE WHEN $2 = 'business_name' AND $3 = 'DESC' THEN b.name END DESC,
        CASE WHEN $2 = 'qualification_date' AND $3 = 'ASC' THEN b.qualification_date END ASC,
        CASE WHEN $2 = 'qualification_date' AND $3 = 'DESC' THEN b.qualification_date END DESC,
        CASE WHEN $2 = 'priority' AND $3 = 'ASC' THEN b.enrichment_priority END ASC,
        CASE WHEN $2 = 'priority' AND $3 = 'DESC' THEN b.enrichment_priority END DESC,
        CASE WHEN $2 = 'email' AND $3 = 'ASC' THEN b.email END ASC,
        CASE WHEN $2 = 'email' AND $3 = 'DESC' THEN b.email END DESC
      LIMIT $4 OFFSET $5
    `

    const result = await pool.query(query, [search, sortBy, sortOrder, limit, offset])

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM businesses b
      WHERE b.ready_for_enrichment = TRUE
        AND b.lifecycle_stage IN ('lead', 'qualified')
        ${statusFilter}
        AND ($1::text IS NULL OR b.name ILIKE '%' || $1 || '%')
    `
    const countResult = await pool.query(countQuery, [search])

    // Get statistics
    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE enrichment_status = 'pending')::INTEGER AS pending,
        COUNT(*) FILTER (WHERE enrichment_status = 'in_progress')::INTEGER AS in_progress,
        COUNT(*) FILTER (WHERE enrichment_status = 'completed')::INTEGER AS completed,
        COUNT(*) FILTER (WHERE enrichment_completed_at >= CURRENT_DATE)::INTEGER AS completed_today,
        AVG(enrichment_confidence) AS avg_confidence
      FROM businesses
      WHERE ready_for_enrichment = TRUE
        AND lifecycle_stage IN ('lead', 'qualified')
    `
    const statsResult = await pool.query(statsQuery)
    const stats = statsResult.rows[0] || {}

    return NextResponse.json({
      leads: result.rows,
      total: parseInt(countResult.rows[0].total),
      stats: {
        pending: parseInt(stats.pending || 0),
        inProgress: parseInt(stats.in_progress || 0),
        completed: parseInt(stats.completed || 0),
        completedToday: parseInt(stats.completed_today || 0),
        avgConfidence: parseFloat(stats.avg_confidence || 0),
      },
    })
  } catch (error) {
    console.error('Error fetching enrichment leads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch enrichment leads' },
      { status: 500 }
    )
  }
}
