/**
 * Crawl Statistics API
 * GET /api/crawl/stats - Get dashboard statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { crawlQueueManager } from '@/lib/services/crawl-queue-manager';

/**
 * GET /api/crawl/stats
 * Get comprehensive crawl statistics for dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId') || undefined;

    console.log('📊 GET /api/crawl/stats');

    // Get dashboard stats
    const stats = await crawlQueueManager.getDashboardStats(organizationId);

    // Get queue status
    const queueStatus = await crawlQueueManager.getQueueStatus(organizationId);

    // Calculate efficiency metrics
    const efficiency = {
      cacheHitRate: stats.crawlStatus.upToDate / (stats.totalBusinesses || 1),
      avgCostPerBusiness: stats.costAnalysis.avgCostPerBusiness,
      projectedMonthlyCost: stats.crawlStatus.dueForRecrawl * 0.01, // Rough estimate
      incrementalSavings: stats.costAnalysis.totalSpent * 0.6 // Assume 60% savings from incremental
    };

    return NextResponse.json({
      success: true,
      totalBusinesses: stats.totalBusinesses,
      crawlStatus: stats.crawlStatus,
      costAnalysis: {
        ...stats.costAnalysis,
        projectedMonthlyCost: efficiency.projectedMonthlyCost
      },
      efficiency: {
        cacheHitRate: `${(efficiency.cacheHitRate * 100).toFixed(1)}%`,
        avgCostPerBusiness: efficiency.avgCostPerBusiness.toFixed(4),
        estimatedIncrementalSavings: efficiency.incrementalSavings.toFixed(2)
      },
      queue: {
        totalQueued: queueStatus.stats.totalQueued,
        totalInProgress: queueStatus.stats.totalInProgress,
        estimatedTotalCost: queueStatus.stats.estimatedTotalCost
      }
    });

  } catch (error: any) {
    console.error('❌ GET /api/crawl/stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
