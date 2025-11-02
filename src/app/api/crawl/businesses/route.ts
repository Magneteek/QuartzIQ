/**
 * Business Crawl Management API
 * GET /api/crawl/businesses - List businesses with crawl status
 */

import { NextRequest, NextResponse } from 'next/server';
import { crawlQueueManager } from '@/lib/services/crawl-queue-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const category = searchParams.get('category') || undefined;
    const city = searchParams.get('city') || undefined;
    const crawlStatus = searchParams.get('crawlStatus') as any || undefined;
    const inQueue = searchParams.get('inQueue') === 'true' ? true : undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = (searchParams.get('sortBy') as any) || 'lastCrawled';
    const sortOrder = (searchParams.get('sortOrder') as any) || 'asc';

    console.log('📊 GET /api/crawl/businesses', {
      category,
      city,
      crawlStatus,
      inQueue,
      limit,
      offset,
      sortBy,
      sortOrder
    });

    // Get businesses with crawl status
    const result = await crawlQueueManager.getBusinessesWithCrawlStatus({
      category,
      city,
      crawlStatus,
      inQueue,
      limit,
      offset,
      sortBy,
      sortOrder
    });

    // Calculate stats for different crawl statuses
    const statsResult = await crawlQueueManager.getDashboardStats();

    return NextResponse.json({
      success: true,
      businesses: result.businesses,
      total: result.total,
      stats: statsResult.crawlStatus,
      pagination: {
        limit,
        offset,
        total: result.total,
        hasMore: offset + limit < result.total
      }
    });

  } catch (error: any) {
    console.error('❌ GET /api/crawl/businesses error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
