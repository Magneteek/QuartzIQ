/**
 * Optimized Extraction API Endpoint
 * Uses PostgreSQL cache to minimize Apify costs
 *
 * Authentication: X-API-Key header
 * Expected savings: 60-80% reduction in API costs
 */

import { NextRequest, NextResponse } from 'next/server';
import { optimizedExtractor, ExtractionOptions } from '@/lib/services/optimized-extractor';
import { db } from '../../../../database/db';

/**
 * Authenticate API key and get organization
 */
async function authenticateApiKey(apiKey: string): Promise<string | null> {
  if (!apiKey || !apiKey.startsWith('quartziq_')) {
    return null;
  }

  try {
    const result = await db.query(`
      SELECT id, subscription_status, monthly_extraction_limit
      FROM organizations
      WHERE api_key = $1 AND subscription_status = 'active'
    `, [apiKey]);

    if (result.rows.length === 0) {
      return null;
    }

    // Check monthly extraction limit
    const org = result.rows[0];
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const usageResult = await db.query(`
      SELECT COUNT(*) as extraction_count
      FROM extractions
      WHERE organization_id = $1
        AND started_at >= DATE_TRUNC('month', CURRENT_DATE)
        AND status = 'completed'
    `, [org.id]);

    const currentUsage = parseInt(usageResult.rows[0].extraction_count);

    if (currentUsage >= org.monthly_extraction_limit) {
      throw new Error(`Monthly extraction limit reached (${org.monthly_extraction_limit}). Please upgrade your plan.`);
    }

    return org.id;
  } catch (error: any) {
    console.error('Authentication error:', error);
    if (error.message.includes('Monthly extraction limit')) {
      throw error;
    }
    return null;
  }
}

/**
 * POST /api/extract-optimized
 * Optimized extraction with database caching
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate API key
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key. Include X-API-Key header.' },
        { status: 401 }
      );
    }

    let organizationId: string | null;
    try {
      organizationId = await authenticateApiKey(apiKey);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Invalid or inactive API key' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const searchCriteria = await request.json();

    // Validate required fields
    if (!searchCriteria.category || !searchCriteria.location) {
      return NextResponse.json(
        { error: 'Category and location are required' },
        { status: 400 }
      );
    }

    // 3. Build extraction options
    const extractionOptions: ExtractionOptions = {
      organizationId,
      category: searchCriteria.category,
      location: searchCriteria.location,
      countryCode: searchCriteria.countryCode || 'nl',
      maxBusinessRating: searchCriteria.maxBusinessRating || 4.6,
      maxReviewStars: searchCriteria.maxReviewStars || 3,
      dayLimit: searchCriteria.dayLimit || 14,
      businessLimit: searchCriteria.businessLimit || 50,
      maxReviewsPerBusiness: searchCriteria.maxReviewsPerBusiness || 2, // Default: 2 reviews (cost optimization)
      language: searchCriteria.language || 'nl',
      useCache: searchCriteria.useCache !== false || searchCriteria.useCached === true, // Support both useCache and useCached
      forceRefresh: searchCriteria.forceRefresh || false
    };

    console.log('\n🔐 Authenticated extraction request');
    console.log(`   Organization: ${organizationId}`);
    console.log(`   Category: ${searchCriteria.category}`);
    console.log(`   Location: ${searchCriteria.location}`);
    console.log(`   useCached flag: ${searchCriteria.useCached}`);
    console.log(`   Cache enabled: ${extractionOptions.useCache}`);

    // 4. Run optimized extraction
    const result = await optimizedExtractor.extract(extractionOptions);

    // 5. Return results with cost savings
    return NextResponse.json({
      success: true,
      extraction_id: result.extraction_id,
      businesses: {
        total: result.businesses.total,
        cached: result.businesses.cached,
        new: result.businesses.new,
        list: result.businesses.businesses.map(b => ({
          // Transform to frontend format
          id: b.id,
          placeId: b.place_id,
          name: b.name,  // Keep original database name for Contact Vault
          title: b.name,  // Also provide as title for frontend display
          address: b.address,
          city: b.city,
          categoryName: b.category || 'Unknown',
          totalScore: b.rating || 0,
          reviewsCount: b.reviews_count || 0,
          phone: b.phone,
          website: b.website,
          url: b.google_maps_url
        }))
      },
      reviews: {
        total: result.reviews.total,
        cached: result.reviews.cached,
        new: result.reviews.new,
        list: result.reviews.reviews.map((r: any) => {
          // Find the business for this review to include the name
          const business = result.businesses.businesses.find((b: any) => b.id === r.business_id);

          return {
            // Transform database format to frontend format
            id: r.id,
            reviewId: r.review_id,
            name: r.reviewer_name,
            stars: r.rating,
            text: r.text,
            publishedAtDate: r.published_date,
            originalLanguage: r.language || 'unknown',
            // Additional fields that might be present
            sentiment_score: r.sentiment_score,
            sentiment_label: r.sentiment_label,
            business_id: r.business_id,
            // ADD BUSINESS NAME for Contact Vault display
            business_name: business?.name || 'Unknown Business',
            business_title: business?.name || 'Unknown Business'
          };
        })
      },
      cost: {
        apify_credits_used: result.cost.apify_credits,
        apify_cost_usd: result.cost.apify_cost_usd,
        savings_usd: result.cost.savings_usd,
        cache_hit_rate: `${(result.performance.cache_hit_rate * 100).toFixed(1)}%`
      },
      performance: {
        duration_ms: result.performance.duration_ms,
        duration_seconds: (result.performance.duration_ms / 1000).toFixed(1)
      },
      metadata: {
        extraction_date: new Date().toISOString(),
        cache_enabled: extractionOptions.useCache,
        force_refresh: extractionOptions.forceRefresh
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Extraction API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/extract-optimized
 * Return API documentation
 */
export async function GET() {
  return NextResponse.json({
    name: 'QuartzIQ Optimized Extraction API',
    version: '1.0.0',
    description: 'Database-optimized review extraction with 60-80% cost savings',
    authentication: {
      method: 'API Key',
      header: 'X-API-Key',
      format: 'quartziq_[64-char-hex]'
    },
    endpoints: {
      POST: {
        description: 'Extract business reviews with database caching',
        required_parameters: {
          category: 'string (e.g., "tandarts", "restaurant")',
          location: 'string (e.g., "Amsterdam", "Utrecht")'
        },
        optional_parameters: {
          businessLimit: 'number (default: 50, max: 100)',
          maxReviewStars: 'number (default: 3, range: 1-5)',
          dayLimit: 'number (default: 14, reviews from last N days)',
          maxReviewsPerBusiness: 'number (default: 2, range: 1-50)',
          language: 'string (default: "nl")',
          countryCode: 'string (default: "nl")',
          maxBusinessRating: 'number (default: 4.6)',
          useCache: 'boolean (default: true)',
          forceRefresh: 'boolean (default: false)'
        },
        response: {
          success: 'boolean',
          extraction_id: 'uuid',
          businesses: 'object (total, cached, new, list)',
          reviews: 'object (total, cached, new, list)',
          cost: 'object (apify_credits, cost_usd, savings_usd)',
          performance: 'object (duration_ms, cache_hit_rate)'
        }
      }
    },
    examples: {
      curl: `curl -X POST https://your-domain.com/api/extract-optimized \\
  -H "X-API-Key: quartziq_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "category": "tandarts",
    "location": "Amsterdam",
    "businessLimit": 20,
    "maxReviewStars": 3,
    "dayLimit": 14
  }'`
    },
    cost_optimization: {
      business_cache: 'Reuses placeIDs from previous extractions',
      review_deduplication: 'Filters duplicate reviews before processing',
      incremental_updates: 'Only fetches reviews newer than cached data',
      multi_tenant_sharing: 'All clients benefit from shared business cache',
      estimated_savings: '60-80% reduction in Apify costs'
    }
  });
}
