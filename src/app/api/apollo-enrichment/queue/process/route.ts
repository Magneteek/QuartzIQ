/**
 * Apollo Enrichment API - Queue Processor
 *
 * POST /api/apollo-enrichment/queue/process
 * Process queued enrichment jobs
 *
 * Request Body:
 * {
 *   maxJobs?: number;  // Maximum jobs to process (default: 10)
 * }
 *
 * Response: Streaming
 * - Real-time updates as jobs are processed
 * - JSON lines format (one JSON object per line)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ContactEnrichmentOrchestrator } from '@/services/contact-enrichment-orchestrator';

export async function POST(request: NextRequest) {
  // Get Apollo API key from environment
  const apolloApiKey = process.env.APOLLO_API_KEY;
  if (!apolloApiKey) {
    return NextResponse.json(
      { error: 'Apollo API key not configured' },
      { status: 500 }
    );
  }

  const apolloMonthlyLimit = parseInt(process.env.APOLLO_MONTHLY_LIMIT || '100');

  try {
    const body = await request.json();
    const maxJobs = body.maxJobs || 10;

    // Set up streaming response for real-time updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendUpdate = (type: string, data: any) => {
          const chunk = encoder.encode(`${JSON.stringify({ type, ...data })}\n`);
          controller.enqueue(chunk);
        };

        try {
          sendUpdate('start', {
            message: 'Starting queue processor...',
            maxJobs,
          });

          // Initialize orchestrator
          const orchestrator = new ContactEnrichmentOrchestrator(
            apolloApiKey,
            apolloMonthlyLimit
          );

          let processedJobs = 0;
          let totalCost = 0;
          let totalApiCalls = 0;
          let successfulJobs = 0;
          let failedJobs = 0;

          // Process queue
          while (processedJobs < maxJobs) {
            // Get next job
            const job = await orchestrator.getNextEnrichmentJob();

            if (!job) {
              sendUpdate('info', {
                message: 'No more jobs in queue',
              });
              break;
            }

            sendUpdate('job_start', {
              jobNumber: processedJobs + 1,
              totalJobs: maxJobs,
              queueId: job.id,
              businessId: job.business_id,
              businessName: job.business.name,
              businessWebsite: job.business.website,
            });

            // Update status to processing
            await orchestrator.updateQueueStatus(job.id, 'processing');

            // Enrich the business
            const result = await orchestrator.enrichBusiness(job.business_id);

            // Update queue with result
            await orchestrator.updateQueueStatus(
              job.id,
              result.success ? 'completed' : 'failed',
              result
            );

            // Update counters
            processedJobs++;
            totalCost += result.totalCostUsd;
            totalApiCalls += result.totalApiCalls;

            if (result.success) {
              successfulJobs++;
            } else {
              failedJobs++;
            }

            // Send job result
            sendUpdate('job_complete', {
              jobNumber: processedJobs,
              totalJobs: maxJobs,
              success: result.success,
              businessId: result.businessId,
              businessName: result.businessName,
              executivesFound: result.executivesFound,
              contactsEnriched: result.contactsEnriched,
              apiCalls: result.totalApiCalls,
              cost: result.totalCostUsd,
              method: result.method,
              duration: result.durationMs,
              error: result.error,
            });

            // Send progress update
            const progress = Math.round((processedJobs / maxJobs) * 100);
            sendUpdate('progress', {
              progress,
              processedJobs,
              maxJobs,
              totalCost,
              totalApiCalls,
              successfulJobs,
              failedJobs,
            });
          }

          // Get final Apollo API usage stats
          const usageStats = orchestrator['apollo'].getUsageStats();

          // Close database connection
          await orchestrator.close();

          // Send final summary
          sendUpdate('complete', {
            message: 'Queue processing complete',
            processedJobs,
            successfulJobs,
            failedJobs,
            totalCost,
            totalApiCalls,
            apolloUsage: usageStats,
          });
        } catch (error: any) {
          console.error('Queue processor error:', error);
          sendUpdate('error', {
            error: error.message || 'Unknown error occurred',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Queue processor API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        success: false,
      },
      { status: 500 }
    );
  }
}
