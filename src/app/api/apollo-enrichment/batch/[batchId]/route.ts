/**
 * Apollo Enrichment API - Batch Status
 *
 * GET /api/apollo-enrichment/batch/[batchId]
 * Get detailed status for a specific enrichment batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Initialize database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;

    if (!batchId) {
      return NextResponse.json(
        { error: 'batchId is required' },
        { status: 400 }
      );
    }

    // Get batch summary
    const summaryQuery = `
      SELECT
        batch_id,
        batch_name,
        organization_id,
        COUNT(*)::INTEGER as total_businesses,
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as completed,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as failed,
        COUNT(*) FILTER (WHERE status = 'queued')::INTEGER as queued,
        COUNT(*) FILTER (WHERE status = 'in_progress')::INTEGER as in_progress,
        COALESCE(SUM(executives_found), 0)::INTEGER as total_executives,
        COALESCE(SUM(total_api_calls), 0)::INTEGER as total_api_calls,
        COALESCE(SUM(total_cost_usd), 0)::DECIMAL as total_cost,
        MIN(queued_at) as queued_at,
        MAX(completed_at) as last_completed_at,
        CASE
          WHEN COUNT(*) > 0 THEN
            ROUND((COUNT(*) FILTER (WHERE status IN ('completed', 'failed'))::DECIMAL / COUNT(*)) * 100, 1)
          ELSE 0
        END as progress_percent
      FROM enrichment_queue
      WHERE batch_id = $1
      GROUP BY batch_id, batch_name, organization_id
    `;

    const summaryResult = await db.query(summaryQuery, [batchId]);

    if (summaryResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    const summary = summaryResult.rows[0];

    // Determine batch status
    let batchStatus: string;
    if (summary.in_progress > 0) {
      batchStatus = 'in_progress';
    } else if (summary.queued > 0) {
      batchStatus = 'queued';
    } else if (summary.completed === summary.total_businesses) {
      batchStatus = 'completed';
    } else if (summary.failed > 0) {
      batchStatus = 'completed_with_failures';
    } else {
      batchStatus = 'unknown';
    }

    // Get detailed job list
    const jobsQuery = `
      SELECT
        eq.id as queue_id,
        eq.business_id,
        eq.status,
        eq.priority,
        eq.position_in_batch,
        eq.queued_at,
        eq.started_at,
        eq.completed_at,
        eq.executives_found,
        eq.total_api_calls,
        eq.total_cost_usd,
        eq.error_message,
        b.name as business_name,
        b.website as business_website,
        b.city as business_city,
        b.rating as business_rating,
        ce.first_name,
        ce.last_name,
        ce.email,
        ce.phone,
        ce.title,
        ce.reveal_method
      FROM enrichment_queue eq
      INNER JOIN businesses b ON b.id = eq.business_id
      LEFT JOIN contact_enrichments ce ON ce.business_id = eq.business_id
      WHERE eq.batch_id = $1
      ORDER BY eq.position_in_batch ASC
    `;

    const jobsResult = await db.query(jobsQuery, [batchId]);

    // Calculate estimated time remaining
    const completedJobs = summary.completed + summary.failed;
    const remainingJobs = summary.total_businesses - completedJobs;
    const avgTimePerJob = completedJobs > 0
      ? (Date.now() - new Date(summary.queued_at).getTime()) / completedJobs
      : 0;
    const estimatedTimeRemainingMs = avgTimePerJob * remainingJobs;

    return NextResponse.json({
      success: true,
      batch: {
        id: summary.batch_id,
        name: summary.batch_name,
        organizationId: summary.organization_id,
        status: batchStatus,
        queuedAt: summary.queued_at,
        lastCompletedAt: summary.last_completed_at,
      },
      progress: {
        total: summary.total_businesses,
        completed: summary.completed,
        failed: summary.failed,
        queued: summary.queued,
        inProgress: summary.in_progress,
        percent: parseFloat(summary.progress_percent),
      },
      results: {
        executivesFound: summary.total_executives,
        apiCalls: summary.total_api_calls,
        totalCost: parseFloat(summary.total_cost),
        avgCostPerBusiness:
          summary.total_businesses > 0
            ? parseFloat(summary.total_cost) / summary.total_businesses
            : 0,
      },
      timing: {
        estimatedTimeRemainingMs:
          batchStatus === 'in_progress' || batchStatus === 'queued'
            ? Math.round(estimatedTimeRemainingMs)
            : 0,
        estimatedCompletionTime:
          batchStatus === 'in_progress' || batchStatus === 'queued'
            ? new Date(Date.now() + estimatedTimeRemainingMs)
            : null,
      },
      jobs: jobsResult.rows.map((job) => ({
        queueId: job.queue_id,
        businessId: job.business_id,
        businessName: job.business_name,
        businessWebsite: job.business_website,
        businessCity: job.business_city,
        businessRating: job.business_rating,
        status: job.status,
        priority: job.priority,
        position: job.position_in_batch,
        queuedAt: job.queued_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        executivesFound: job.executives_found,
        apiCalls: job.total_api_calls,
        cost: parseFloat(job.total_cost_usd || 0),
        error: job.error_message,
        contact: job.first_name
          ? {
              firstName: job.first_name,
              lastName: job.last_name,
              email: job.email,
              phone: job.phone,
              title: job.title,
              revealMethod: job.reveal_method,
            }
          : null,
      })),
    });
  } catch (error: any) {
    console.error('Batch status API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        success: false,
      },
      { status: 500 }
    );
  }
}
