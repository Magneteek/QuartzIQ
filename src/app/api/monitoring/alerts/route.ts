/**
 * API Route: Get Monitoring Alerts
 * GET /api/monitoring/alerts
 * Enhanced with filtering, search, and statistics
 */

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
    const { error } = await requireRoleAPI(['admin', 'va', 'enrichment'])
    if (error) return error

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const severityFilter = searchParams.get('severity') || 'all'
    const statusFilter = searchParams.get('status') || 'all'
    const search = searchParams.get('search') || null

    // Build filters
    let severityCondition = ''
    if (severityFilter !== 'all') {
      severityCondition = `AND cma.severity = '${severityFilter}'`
    }

    let statusCondition = ''
    if (statusFilter === 'unacknowledged') {
      statusCondition = 'AND cma.acknowledged_at IS NULL'
    } else if (statusFilter === 'acknowledged') {
      statusCondition = 'AND cma.acknowledged_at IS NOT NULL AND cma.resolved_at IS NULL'
    } else if (statusFilter === 'resolved') {
      statusCondition = 'AND cma.resolved_at IS NOT NULL'
    }

    const query = `
      SELECT
        cma.id,
        cma.business_id,
        CAST(b.name AS TEXT) AS business_name,
        CAST(b.customer_tier AS TEXT) AS customer_tier,
        cma.review_id,
        CAST(cma.review_text AS TEXT) AS review_text,
        CAST(cma.reviewer_name AS TEXT) AS reviewer_name,
        cma.review_stars AS review_rating,
        cma.review_date,
        CAST(cma.alert_type AS TEXT) AS alert_type,
        CAST(cma.severity AS TEXT) AS severity,
        cma.detected_at,
        cma.acknowledged_at,
        cma.acknowledged_by,
        cma.resolved_at,
        cma.resolved_by,
        CAST(cma.action_taken AS TEXT) AS action_taken,
        CAST(u1.name AS TEXT) AS acknowledged_by_name,
        CAST(u2.name AS TEXT) AS resolved_by_name
      FROM customer_monitoring_alerts cma
      INNER JOIN businesses b ON cma.business_id = b.id
      LEFT JOIN users u1 ON cma.acknowledged_by = u1.id
      LEFT JOIN users u2 ON cma.resolved_by = u2.id
      WHERE 1=1
        ${severityCondition}
        ${statusCondition}
        AND ($1::text IS NULL OR b.name ILIKE '%' || $1 || '%')
      ORDER BY
        CASE WHEN cma.acknowledged_at IS NULL THEN 0 ELSE 1 END,
        cma.detected_at DESC
      LIMIT $2 OFFSET $3
    `

    const result = await pool.query(query, [search, limit, offset])

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM customer_monitoring_alerts cma
      INNER JOIN businesses b ON cma.business_id = b.id
      WHERE 1=1
        ${severityCondition}
        ${statusCondition}
        AND ($1::text IS NULL OR b.name ILIKE '%' || $1 || '%')
    `
    const countResult = await pool.query(countQuery, [search])

    // Get statistics
    const statsQuery = `
      SELECT
        COUNT(*)::INTEGER AS total_alerts,
        COUNT(*) FILTER (WHERE acknowledged_at IS NULL)::INTEGER AS unacknowledged,
        COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL AND resolved_at IS NULL)::INTEGER AS acknowledged,
        COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)::INTEGER AS resolved,
        COUNT(*) FILTER (WHERE resolved_at >= CURRENT_DATE)::INTEGER AS resolved_today,
        COUNT(*) FILTER (WHERE severity = 'critical')::INTEGER AS critical_alerts,
        COUNT(*) FILTER (WHERE severity = 'high')::INTEGER AS high_alerts,
        COUNT(*) FILTER (WHERE severity = 'medium')::INTEGER AS medium_alerts,
        COUNT(*) FILTER (WHERE severity = 'low')::INTEGER AS low_alerts
      FROM customer_monitoring_alerts
    `
    const statsResult = await pool.query(statsQuery)
    const stats = statsResult.rows[0] || {}

    return NextResponse.json({
      alerts: result.rows,
      total: parseInt(countResult.rows[0].total),
      stats: {
        totalAlerts: parseInt(stats.total_alerts || 0),
        unacknowledged: parseInt(stats.unacknowledged || 0),
        acknowledged: parseInt(stats.acknowledged || 0),
        resolved: parseInt(stats.resolved || 0),
        resolvedToday: parseInt(stats.resolved_today || 0),
        criticalAlerts: parseInt(stats.critical_alerts || 0),
        highAlerts: parseInt(stats.high_alerts || 0),
        mediumAlerts: parseInt(stats.medium_alerts || 0),
        lowAlerts: parseInt(stats.low_alerts || 0),
      },
    })

  } catch (error) {
    console.error('Failed to get alerts:', error)
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
 * POST /api/monitoring/alerts
 * Acknowledge or resolve alerts
 */
export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requireRoleAPI(['admin', 'va'])
    if (error) return error

    const body = await request.json()
    const { alertId, action, actionTaken } = body

    if (!alertId || !action) {
      return NextResponse.json(
        { success: false, error: 'alertId and action are required' },
        { status: 400 }
      )
    }

    const userId = session?.user?.id

    if (action === 'acknowledge') {
      await pool.query(
        `UPDATE customer_monitoring_alerts
         SET acknowledged_at = NOW(),
             acknowledged_by = $2,
             action_taken = $3
         WHERE id = $1`,
        [alertId, userId, actionTaken || null]
      )
    } else if (action === 'resolve') {
      await pool.query(
        `UPDATE customer_monitoring_alerts
         SET resolved_at = NOW(),
             resolved_by = $2,
             acknowledged_at = COALESCE(acknowledged_at, NOW()),
             acknowledged_by = COALESCE(acknowledged_by, $2),
             action_taken = $3
         WHERE id = $1`,
        [alertId, userId, actionTaken || null]
      )
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "acknowledge" or "resolve"' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Alert ${action}d successfully`,
    })

  } catch (error) {
    console.error('Failed to update alert:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
