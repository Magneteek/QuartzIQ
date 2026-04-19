/**
 * Crawl Queue Management API
 * GET /api/crawl/queue - Get queue status
 * POST /api/crawl/queue - Add businesses to queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { crawlQueueManager } from '@/lib/services/crawl-queue-manager';

/**
 * GET /api/crawl/queue
 * Get current queue status with batch information
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId') || undefined;

    console.log('📊 GET /api/crawl/queue');

    const queueStatus = await crawlQueueManager.getQueueStatus(organizationId);

    return NextResponse.json({
      success: true,
      ...queueStatus
    });

  } catch (error: any) {
    console.error('❌ GET /api/crawl/queue error:', error);
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
 * POST /api/crawl/queue
 * Add businesses to crawl queue
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      organizationId,
      businessIds,
      batchName,
      priority,
      scheduledFor,
      crawlConfig
    } = body;

    // Validation
    if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'businessIds array is required' },
        { status: 400 }
      );
    }

    console.log(`📝 POST /api/crawl/queue - Adding ${businessIds.length} businesses`);

    // Add to queue
    const batchInfo = await crawlQueueManager.addToQueue({
      organizationId,
      businessIds,
      batchName,
      priority,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      crawlConfig
    });

    console.log(`✅ Batch created: ${batchInfo.batchId}`);

    return NextResponse.json({
      success: true,
      batch: batchInfo
    });

  } catch (error: any) {
    console.error('❌ POST /api/crawl/queue error:', error);
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
 * DELETE /api/crawl/queue
 * Cancel a batch
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json(
        { success: false, error: 'batchId is required' },
        { status: 400 }
      );
    }

    console.log(`🗑️ DELETE /api/crawl/queue - Cancelling batch: ${batchId}`);

    await crawlQueueManager.cancelBatch(batchId);

    return NextResponse.json({
      success: true,
      message: `Batch ${batchId} cancelled`
    });

  } catch (error: any) {
    console.error('❌ DELETE /api/crawl/queue error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
