/**
 * Business Crawl History API
 * GET /api/crawl/businesses/[businessId]/history - Get crawl history for specific business
 */

import { NextRequest, NextResponse } from 'next/server';
import { incrementalCrawler } from '@/lib/services/incremental-crawler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    console.log(`📊 GET /api/crawl/businesses/${businessId}/history`);

    // Get crawl history
    const history = await incrementalCrawler.getCrawlHistory(businessId);

    // Calculate totals
    const totals = {
      totalCrawls: history.length,
      totalReviewsFound: history.reduce((sum, c) => sum + (c.reviews_found || 0), 0),
      totalReviewsNew: history.reduce((sum, c) => sum + (c.reviews_new || 0), 0),
      totalCostUsd: history.reduce((sum, c) => sum + parseFloat(c.apify_cost_usd || 0), 0),
      incrementalCrawls: history.filter(c => c.is_incremental).length,
      avgReviewsPerCrawl: history.length > 0
        ? Math.round(history.reduce((sum, c) => sum + (c.reviews_found || 0), 0) / history.length)
        : 0
    };

    return NextResponse.json({
      success: true,
      businessId,
      history: history.map(crawl => ({
        id: crawl.id,
        crawledAt: crawl.crawled_at,
        durationSeconds: crawl.crawl_duration_seconds,
        reviewsFound: crawl.reviews_found,
        reviewsNew: crawl.reviews_new,
        reviewsDuplicate: crawl.reviews_duplicate,
        isIncremental: crawl.is_incremental,
        costUsd: parseFloat(crawl.apify_cost_usd),
        nextRecommendedCrawl: crawl.next_recommended_crawl,
        status: crawl.status
      })),
      totals
    });

  } catch (error: any) {
    console.error('❌ GET /api/crawl/businesses/[businessId]/history error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
