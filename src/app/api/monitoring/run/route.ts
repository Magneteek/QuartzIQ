/**
 * API Route: Run Customer Monitoring Cycle
 * POST /api/monitoring/run
 * Triggers a monitoring cycle for all customers needing checks
 */

import { NextRequest, NextResponse } from 'next/server'
import { customerMonitoringService } from '@/lib/services/customer-monitoring'

export async function POST(request: NextRequest) {
  try {
    // Run the monitoring cycle
    const results = await customerMonitoringService.runMonitoringCycle()

    // Calculate summary stats
    const summary = {
      totalCustomers: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalReviewsFound: results.reduce((sum, r) => sum + r.reviewsFound, 0),
      totalNegativeReviews: results.reduce((sum, r) => sum + r.negativeReviewsFound, 0),
      totalAlertsCreated: results.reduce((sum, r) => sum + r.alertsCreated, 0),
      totalCostUsd: Number(results.reduce((sum, r) => sum + r.scrapeCostUsd, 0).toFixed(4)),
      totalDurationMs: results.reduce((sum, r) => sum + r.scrapeDurationMs, 0),
    }

    return NextResponse.json({
      success: true,
      summary,
      results,
    })

  } catch (error) {
    console.error('Monitoring cycle failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
