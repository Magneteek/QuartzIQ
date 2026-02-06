/**
 * Cron Job: Automated Customer Monitoring
 * GET /api/cron/monitoring
 *
 * Schedule: Daily at 2 AM
 *
 * This endpoint should be called by a cron service to automatically run monitoring cycles.
 * Checks customers due for monitoring and sends alerts to GoHighLevel for negative reviews.
 *
 * Example Vercel Cron configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/monitoring",
 *     "schedule": "0 2 * * *"  // Run daily at 2 AM (in UTC)
 *   }]
 * }
 *
 * Alternative: External cron service (cron-job.org, EasyCron, etc.):
 * - Schedule: Daily at 2 AM your timezone
 * - URL: https://your-domain.com/api/cron/monitoring
 * - Method: GET
 * - Headers: Authorization: Bearer YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { customerMonitoringService } from '@/lib/services/customer-monitoring'

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || process.env.MONITORING_CRON_SECRET

  if (!cronSecret) {
    console.error('❌ CRON_SECRET not configured in environment variables')
    return NextResponse.json(
      { success: false, error: 'Cron secret not configured' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ Unauthorized cron request attempt')
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    console.log('🔄 [CRON] Starting automated customer monitoring cycle...')
    console.log(`📅 [CRON] Timestamp: ${new Date().toISOString()}`)

    const results = await customerMonitoringService.runMonitoringCycle()
    const duration = Date.now() - startTime

    const summary = {
      totalCustomers: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalReviewsFound: results.reduce((sum, r) => sum + r.reviewsFound, 0),
      totalNewReviews: results.reduce((sum, r) => sum + r.newReviewsCount, 0),
      totalNegativeReviews: results.reduce((sum, r) => sum + r.negativeReviewsFound, 0),
      totalAlertsCreated: results.reduce((sum, r) => sum + r.alertsCreated, 0),
      totalCostUsd: Number(results.reduce((sum, r) => sum + r.scrapeCostUsd, 0).toFixed(4)),
      durationMs: duration,
      durationSeconds: (duration / 1000).toFixed(1),
    }

    console.log('✅ [CRON] Monitoring cycle complete:', {
      customers: summary.totalCustomers,
      newReviews: summary.totalNewReviews,
      negativeReviews: summary.totalNegativeReviews,
      alerts: summary.totalAlertsCreated,
      cost: `$${summary.totalCostUsd}`,
      duration: `${summary.durationSeconds}s`,
    })

    // Log any failures
    if (summary.failed > 0) {
      const failures = results.filter(r => !r.success)
      console.warn('⚠️ [CRON] Some customers failed:', failures.map(f => ({
        business: f.businessName,
        error: f.error,
      })))
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      results: results.map(r => ({
        businessName: r.businessName,
        success: r.success,
        newReviews: r.newReviewsCount,
        negativeReviews: r.negativeReviewsFound,
        alertsCreated: r.alertsCreated,
        error: r.error,
      })),
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('❌ [CRON] Monitoring cycle failed:', error)

    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: duration,
      },
      { status: 500 }
    )
  }
}

// Support POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request)
}
