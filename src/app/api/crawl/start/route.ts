/**
 * Crawl Execution API
 * POST /api/crawl/start - Start crawl execution for queued businesses
 */

import { NextRequest, NextResponse } from 'next/server';
import { crawlQueueManager } from '@/lib/services/crawl-queue-manager';
import { incrementalCrawler } from '@/lib/services/incremental-crawler';
import { db } from '../../../../../database/db';

/**
 * POST /api/crawl/start
 * Start executing crawls for a batch or all queued businesses
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchId, maxConcurrent = 1 } = body;

    console.log(`\n🚀 POST /api/crawl/start`);
    console.log(`   Batch ID: ${batchId || 'all queued'}`);
    console.log(`   Max concurrent: ${maxConcurrent}`);

    // Get queued businesses
    let whereClause = "status = 'queued'";
    const params: any[] = [];

    if (batchId) {
      whereClause += " AND batch_id = $1";
      params.push(batchId);
    }

    const queueResult = await db.query(`
      SELECT id, business_id, organization_id, crawl_config
      FROM crawl_queue
      WHERE ${whereClause}
      ORDER BY priority DESC, position_in_batch ASC
      LIMIT 100;
    `, params);

    const queueItems = queueResult.rows;

    if (queueItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No businesses in queue',
        results: []
      });
    }

    console.log(`   Found ${queueItems.length} businesses to crawl`);

    // Start background crawl (non-blocking)
    // In production, this should be a separate worker process
    executeCrawlInBackground(queueItems.map((item: any) => item.id));

    return NextResponse.json({
      success: true,
      message: `Started crawling ${queueItems.length} businesses`,
      queuedCount: queueItems.length,
      batchId: batchId || null
    });

  } catch (error: any) {
    console.error('❌ POST /api/crawl/start error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Execute crawl in background (non-blocking)
 * In production, this would be a separate worker/queue system
 */
async function executeCrawlInBackground(queueIds: string[]) {
  // Fire and forget - don't await
  (async () => {
    try {
      console.log(`\n🔄 Background crawl started for ${queueIds.length} businesses`);
      await incrementalCrawler.crawlFromQueue(queueIds);
      console.log(`\n✅ Background crawl completed`);
    } catch (error: any) {
      console.error(`\n❌ Background crawl failed:`, error.message);
    }
  })();
}
