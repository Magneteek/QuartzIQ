import { NextRequest, NextResponse } from 'next/server';
import { cacheStats } from '@/lib/services/cache-stats';
import { requireRoleAPI } from '@/lib/auth-helpers';

// GET /api/cache/stats - Get cache performance statistics
export async function GET(request: NextRequest) {
  try {
    // Require admin or VA role
    const { error } = await requireRoleAPI(['admin', 'va']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'dashboard';
    const daysBack = parseInt(searchParams.get('days') || '7');

    switch (view) {
      case 'dashboard':
        const dashboard = await cacheStats.getDashboardSummary();
        return NextResponse.json(dashboard);

      case 'hit-rate':
        const hitRate = await cacheStats.getCacheHitRate(daysBack);
        return NextResponse.json(hitRate);

      case 'health':
        const health = await cacheStats.checkCacheHealth(daysBack);
        return NextResponse.json(health);

      case 'savings':
        const savings = await cacheStats.getTotalSavings();
        return NextResponse.json(savings);

      case 'costs':
        const limit = parseInt(searchParams.get('limit') || '30');
        const costs = await cacheStats.getRecentCrawlCosts(limit);
        return NextResponse.json(costs);

      case 'segments':
        const segmentLimit = parseInt(searchParams.get('limit') || '10');
        const segments = await cacheStats.getTopPerformingSegments(segmentLimit);
        return NextResponse.json(segments);

      case 'due-discovery':
        const discoveryLimit = parseInt(searchParams.get('limit') || '100');
        const dueForDiscovery = await cacheStats.getBusinessesDueForDiscovery(discoveryLimit);
        return NextResponse.json(dueForDiscovery);

      case 'due-monitoring':
        const monitoringLimit = parseInt(searchParams.get('limit') || '50');
        const dueForMonitoring = await cacheStats.getCustomersDueForMonitoring(monitoringLimit);
        return NextResponse.json(dueForMonitoring);

      default:
        return NextResponse.json(
          { error: 'Invalid view parameter. Options: dashboard, hit-rate, health, savings, costs, segments, due-discovery, due-monitoring' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cache statistics' },
      { status: 500 }
    );
  }
}

// POST /api/cache/stats - Record a crawl cost
export async function POST(request: NextRequest) {
  try {
    // Require admin or VA role
    const { error } = await requireRoleAPI(['admin', 'va']);
    if (error) return error;

    const body = await request.json();

    const { category, location, crawlType, newBusinessesFound, cachedBusinessesUsed, reviewsScraped, leadsGenerated } = body;

    if (!category || !location || !crawlType) {
      return NextResponse.json(
        { error: 'Missing required fields: category, location, crawlType' },
        { status: 400 }
      );
    }

    if (crawlType !== 'discovery' && crawlType !== 'monitoring') {
      return NextResponse.json(
        { error: 'Invalid crawlType. Must be "discovery" or "monitoring"' },
        { status: 400 }
      );
    }

    const crawlId = await cacheStats.recordCrawlCost({
      category,
      location,
      crawlType,
      newBusinessesFound: newBusinessesFound || 0,
      cachedBusinessesUsed: cachedBusinessesUsed || 0,
      reviewsScraped: reviewsScraped || 0,
      leadsGenerated: leadsGenerated || 0
    });

    // Get updated health status
    const health = await cacheStats.checkCacheHealth(7);

    return NextResponse.json({
      success: true,
      crawlId,
      health
    });
  } catch (error) {
    console.error('Error recording crawl cost:', error);
    return NextResponse.json(
      { error: 'Failed to record crawl cost' },
      { status: 500 }
    );
  }
}
