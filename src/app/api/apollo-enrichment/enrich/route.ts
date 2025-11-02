/**
 * Apollo Enrichment API - Single Business Enrichment
 *
 * POST /api/apollo-enrichment/enrich
 * Enrich a single business with executive contact information
 *
 * Request Body:
 * {
 *   businessId: string;  // UUID of business in database
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   businessId: string;
 *   businessName: string;
 *   executivesFound: number;
 *   contactsEnriched: number;
 *   totalApiCalls: number;
 *   totalCostUsd: number;
 *   method: 'claude_only' | 'enrich_only' | 'search_then_enrich';
 *   durationMs: number;
 *   error?: string;
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ContactEnrichmentOrchestrator } from '@/services/contact-enrichment-orchestrator';

export async function POST(request: NextRequest) {
  try {
    const { businessId } = await request.json();

    // Validate request
    if (!businessId) {
      return NextResponse.json(
        { error: 'businessId is required' },
        { status: 400 }
      );
    }

    // Get Apollo API key from environment
    const apolloApiKey = process.env.APOLLO_API_KEY;
    if (!apolloApiKey) {
      return NextResponse.json(
        { error: 'Apollo API key not configured' },
        { status: 500 }
      );
    }

    // Get Apollo monthly limit (default: 100 for free tier)
    const apolloMonthlyLimit = parseInt(process.env.APOLLO_MONTHLY_LIMIT || '100');

    // Initialize orchestrator
    const orchestrator = new ContactEnrichmentOrchestrator(
      apolloApiKey,
      apolloMonthlyLimit
    );

    // Enrich the business
    const result = await orchestrator.enrichBusiness(businessId);

    // Close database connection
    await orchestrator.close();

    // Return result
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    console.error('Apollo enrichment API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        success: false,
      },
      { status: 500 }
    );
  }
}
