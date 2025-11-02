/**
 * Apollo Enrichment API - Queue Management
 *
 * POST /api/apollo-enrichment/queue
 * Add businesses to enrichment queue for batch processing
 *
 * Request Body:
 * {
 *   organizationId: string;
 *   businessIds: string[];  // Array of business UUIDs
 *   batchName?: string;     // Optional batch name
 *   priority?: number;      // 0-100, default 50
 *   targetExecutiveCount?: number; // Default 1
 * }
 *
 * GET /api/apollo-enrichment/queue
 * Get queued businesses
 *
 * Query Params:
 * - status: queued | processing | completed | failed
 * - limit: number (default 50)
 * - organizationId: string (filter by organization)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Initialize database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export async function POST(request: NextRequest) {
  try {
    const {
      organizationId,
      businessIds,
      batchName,
      priority = 50,
      targetExecutiveCount = 1,
    } = await request.json();

    // Validate request
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
      return NextResponse.json(
        { error: 'businessIds array is required' },
        { status: 400 }
      );
    }

    // Generate batch ID
    const batchId = crypto.randomUUID();
    const finalBatchName = batchName || `Batch ${new Date().toISOString()}`;

    // Insert businesses into queue
    const values: any[] = [];
    const placeholders: string[] = [];

    businessIds.forEach((businessId, index) => {
      const offset = index * 7;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
      );
      values.push(
        organizationId,
        businessId,
        batchId,
        finalBatchName,
        priority,
        index + 1, // position_in_batch
        targetExecutiveCount
      );
    });

    const query = `
      INSERT INTO enrichment_queue (
        organization_id, business_id, batch_id, batch_name,
        priority, position_in_batch, target_executive_count, status, queued_at
      )
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (business_id, status)
      WHERE status IN ('queued', 'in_progress')
      DO NOTHING
      RETURNING *
    `;

    const result = await db.query(query, values);

    return NextResponse.json({
      success: true,
      batchId,
      batchName: finalBatchName,
      businessesQueued: result.rowCount,
      businessesTotal: businessIds.length,
      skipped: businessIds.length - (result.rowCount || 0),
      message:
        result.rowCount === businessIds.length
          ? 'All businesses queued successfully'
          : `${result.rowCount} businesses queued, ${businessIds.length - (result.rowCount || 0)} already in queue`,
    });
  } catch (error: any) {
    console.error('Queue API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        success: false,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'queued';
    const limit = parseInt(searchParams.get('limit') || '50');
    const organizationId = searchParams.get('organizationId');

    let query = `
      SELECT
        eq.id,
        eq.organization_id,
        eq.business_id,
        eq.batch_id,
        eq.batch_name,
        eq.priority,
        eq.position_in_batch,
        eq.status,
        eq.queued_at,
        eq.started_at,
        eq.completed_at,
        eq.target_executive_count,
        eq.executives_found,
        eq.total_api_calls,
        eq.total_cost_usd,
        eq.error_message,
        b.name as business_name,
        b.website as business_website,
        b.city as business_city,
        b.rating as business_rating
      FROM enrichment_queue eq
      INNER JOIN businesses b ON b.id = eq.business_id
      WHERE eq.status = $1
    `;

    const params: any[] = [status];

    if (organizationId) {
      query += ` AND eq.organization_id = $2`;
      params.push(organizationId);
    }

    query += ` ORDER BY eq.priority DESC, eq.queued_at ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);

    return NextResponse.json({
      success: true,
      status,
      count: result.rowCount,
      queue: result.rows,
    });
  } catch (error: any) {
    console.error('Queue GET API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        success: false,
      },
      { status: 500 }
    );
  }
}
