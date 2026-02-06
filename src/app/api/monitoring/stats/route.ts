/**
 * API Route: Get Monitoring Stats
 * GET /api/monitoring/stats
 * Returns current customer monitoring statistics and recent history
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

    // Get overall stats from database function
    const statsResult = await pool.query('SELECT * FROM get_customer_monitoring_stats()')
    const stats = statsResult.rows[0] || {}

    // Get recent monitoring history
    const historyQuery = `
      SELECT
        cmh.id,
        cmh.business_id,
        CAST(b.name AS TEXT) AS business_name,
        cmh.checked_at,
        cmh.reviews_found,
        cmh.negative_reviews_found,
        cmh.alerts_created,
        cmh.scrape_cost_usd,
        cmh.scrape_duration_ms,
        CAST(cmh.status AS TEXT) AS status
      FROM customer_monitoring_history cmh
      INNER JOIN businesses b ON cmh.business_id = b.id
      ORDER BY cmh.checked_at DESC
      LIMIT 20
    `
    const historyResult = await pool.query(historyQuery)

    // Get upcoming checks
    const upcomingQuery = `
      SELECT
        b.id,
        CAST(b.name AS TEXT) AS business_name,
        CAST(b.customer_tier AS TEXT) AS customer_tier,
        b.next_monitoring_check,
        b.monitoring_frequency_hours
      FROM businesses b
      WHERE b.is_paying_customer = TRUE
        AND b.monitoring_enabled = TRUE
        AND b.next_monitoring_check IS NOT NULL
      ORDER BY b.next_monitoring_check ASC
      LIMIT 10
    `
    const upcomingResult = await pool.query(upcomingQuery)

    return NextResponse.json({
      stats: {
        totalCustomers: parseInt(stats.total_customers || 0),
        activeMonitoring: parseInt(stats.active_monitoring || 0),
        totalChecks: parseInt(stats.total_checks || 0),
        totalAlertsCreated: parseInt(stats.total_alerts_created || 0),
        totalReviewsScanned: parseInt(stats.total_reviews_scanned || 0),
        totalCostUsd: parseFloat(stats.total_cost_usd || 0),
        averageCheckDurationMs: parseInt(stats.avg_check_duration_ms || 0),
        successRate: parseFloat(stats.success_rate || 0),
        checksLast24h: parseInt(stats.checks_last_24h || 0),
        alertsLast24h: parseInt(stats.alerts_last_24h || 0),
      },
      recentHistory: historyResult.rows,
      upcomingChecks: upcomingResult.rows,
    })

  } catch (error) {
    console.error('Failed to get monitoring stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
