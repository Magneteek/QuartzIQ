/**
 * Apollo Enrichment API - Statistics
 *
 * GET /api/apollo-enrichment/stats
 * Get Apollo API usage statistics and enrichment metrics
 *
 * Query Params:
 * - organizationId: string (optional)
 * - days: number (default: 30) - last N days of stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { ApolloClient } from '@/services/apollo-client';

// Initialize database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const days = parseInt(searchParams.get('days') || '30');

    // Get Apollo API usage logs
    let apolloUsageQuery = `
      SELECT
        api_endpoint,
        COUNT(*) as call_count,
        SUM(credits_used) as total_credits,
        SUM(cost_usd) as total_cost,
        AVG(duration_ms) as avg_duration_ms,
        COUNT(*) FILTER (WHERE success = TRUE) as successful_calls,
        COUNT(*) FILTER (WHERE success = FALSE) as failed_calls,
        MIN(created_at) as first_call,
        MAX(created_at) as last_call
      FROM apollo_api_log
      WHERE created_at >= NOW() - INTERVAL '${days} days'
    `;

    const apolloParams: any[] = [];

    if (organizationId) {
      apolloUsageQuery += ` AND organization_id = $1`;
      apolloParams.push(organizationId);
    }

    apolloUsageQuery += ` GROUP BY api_endpoint ORDER BY total_cost DESC`;

    const apolloUsageResult = await db.query(apolloUsageQuery, apolloParams);

    // Get enrichment stats using the database function
    let enrichmentStatsQuery: string;
    let enrichmentParams: any[];

    if (organizationId) {
      enrichmentStatsQuery = 'SELECT * FROM get_enrichment_stats($1, $2)';
      enrichmentParams = [organizationId, days];
    } else {
      // Get stats for all organizations
      enrichmentStatsQuery = `
        SELECT
          COUNT(DISTINCT eq.business_id)::INTEGER as total_businesses,
          COUNT(ce.id)::INTEGER as total_enrichments,
          CASE
            WHEN COUNT(ce.id) > 0
            THEN ROUND((COUNT(ce.id) FILTER (WHERE ce.enrichment_status = 'completed')::DECIMAL / COUNT(ce.id)) * 100, 1)
            ELSE 0
          END as success_rate,
          COALESCE(SUM(eq.total_api_calls), 0)::INTEGER as total_api_calls,
          COALESCE(SUM(eq.total_cost_usd), 0)::DECIMAL as total_cost,
          CASE
            WHEN COUNT(DISTINCT eq.business_id) > 0
            THEN ROUND(COALESCE(SUM(eq.total_cost_usd), 0) / COUNT(DISTINCT eq.business_id), 4)
            ELSE 0
          END as avg_cost_per_business,
          COUNT(ce.id) FILTER (WHERE ce.reveal_method = 'claude_only')::INTEGER as claude_only_count,
          COUNT(ce.id) FILTER (WHERE ce.reveal_method = 'enrich_only')::INTEGER as enrich_only_count,
          COUNT(ce.id) FILTER (WHERE ce.reveal_method = 'search_then_enrich')::INTEGER as search_then_enrich_count
        FROM enrichment_queue eq
        LEFT JOIN contact_enrichments ce ON ce.business_id = eq.business_id
        WHERE eq.created_at >= NOW() - INTERVAL '${days} days'
      `;
      enrichmentParams = [];
    }

    const enrichmentStatsResult = await db.query(enrichmentStatsQuery, enrichmentParams);
    const enrichmentStats = enrichmentStatsResult.rows[0] || {};

    // Get queue status summary
    let queueStatusQuery = `
      SELECT
        status,
        COUNT(*) as count,
        SUM(total_cost_usd) as total_cost,
        SUM(total_api_calls) as total_api_calls,
        AVG(EXTRACT(EPOCH FROM (NOW() - queued_at))) as avg_wait_time_seconds
      FROM enrichment_queue
      WHERE queued_at >= NOW() - INTERVAL '${days} days'
    `;

    const queueParams: any[] = [];

    if (organizationId) {
      queueStatusQuery += ` AND organization_id = $1`;
      queueParams.push(organizationId);
    }

    queueStatusQuery += ` GROUP BY status ORDER BY count DESC`;

    const queueStatusResult = await db.query(queueStatusQuery, queueParams);

    // Get method distribution
    const methodDistribution = {
      claude_only: {
        count: parseInt(enrichmentStats.claude_only_count || 0),
        percentage: enrichmentStats.total_enrichments > 0
          ? Math.round((parseInt(enrichmentStats.claude_only_count || 0) / parseInt(enrichmentStats.total_enrichments)) * 100)
          : 0,
        description: 'Completed with Claude website research only (FREE)',
      },
      enrich_only: {
        count: parseInt(enrichmentStats.enrich_only_count || 0),
        percentage: enrichmentStats.total_enrichments > 0
          ? Math.round((parseInt(enrichmentStats.enrich_only_count || 0) / parseInt(enrichmentStats.total_enrichments)) * 100)
          : 0,
        description: 'Claude found name, Apollo enriched (1 API call)',
      },
      search_then_enrich: {
        count: parseInt(enrichmentStats.search_then_enrich_count || 0),
        percentage: enrichmentStats.total_enrichments > 0
          ? Math.round((parseInt(enrichmentStats.search_then_enrich_count || 0) / parseInt(enrichmentStats.total_enrichments)) * 100)
          : 0,
        description: 'Full Apollo workflow (2 API calls)',
      },
    };

    // Get current Apollo API limits from environment
    const apolloMonthlyLimit = parseInt(process.env.APOLLO_MONTHLY_LIMIT || '100');

    // Calculate remaining calls this month
    const currentMonthCallsQuery = `
      SELECT COUNT(*) as call_count
      FROM apollo_api_log
      WHERE created_at >= DATE_TRUNC('month', NOW())
    `;

    const currentMonthCallsResult = await db.query(currentMonthCallsQuery);
    const currentMonthCalls = parseInt(currentMonthCallsResult.rows[0]?.call_count || 0);
    const remainingCalls = apolloMonthlyLimit - currentMonthCalls;

    // Return comprehensive stats
    return NextResponse.json({
      success: true,
      period: {
        days,
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      },
      apolloApi: {
        monthlyLimit: apolloMonthlyLimit,
        currentMonthCalls,
        remainingCalls,
        utilizationPercent: Math.round((currentMonthCalls / apolloMonthlyLimit) * 100),
        byEndpoint: apolloUsageResult.rows,
      },
      enrichment: {
        totalBusinesses: parseInt(enrichmentStats.total_businesses || 0),
        totalEnrichments: parseInt(enrichmentStats.total_enrichments || 0),
        successRate: parseFloat(enrichmentStats.success_rate || 0),
        totalApiCalls: parseInt(enrichmentStats.total_api_calls || 0),
        totalCost: parseFloat(enrichmentStats.total_cost || 0),
        avgCostPerBusiness: parseFloat(enrichmentStats.avg_cost_per_business || 0),
        methodDistribution,
      },
      queue: {
        byStatus: queueStatusResult.rows,
      },
      costSavings: {
        claudeOnlySavings: parseInt(enrichmentStats.claude_only_count || 0) * 0.20, // Saved 2 API calls * $0.10
        enrichOnlySavings: parseInt(enrichmentStats.enrich_only_count || 0) * 0.10, // Saved 1 API call * $0.10
        totalSavings: (parseInt(enrichmentStats.claude_only_count || 0) * 0.20) +
                      (parseInt(enrichmentStats.enrich_only_count || 0) * 0.10),
        description: 'Cost savings from Claude website research optimization',
      },
    });
  } catch (error: any) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        success: false,
      },
      { status: 500 }
    );
  }
}
