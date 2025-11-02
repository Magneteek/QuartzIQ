/**
 * Cache Detection API
 * Checks if businesses are already cached for a given category/location
 * Returns count and cost comparison for UX display
 *
 * Handles language mapping: English category IDs → Dutch database categories
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../database/db';
import { generateCategoryWhereClause } from '@/lib/utils/category-mapping';

export async function POST(request: NextRequest) {
  try {
    const { category, location } = await request.json();

    if (!category || !location) {
      return NextResponse.json(
        { error: 'Category and location are required' },
        { status: 400 }
      );
    }

    // Generate category WHERE clause with Dutch mappings
    const { clause: categoryClause, params: categoryParams } = generateCategoryWhereClause(category, 1);

    // Build location parameters
    const locationParam = categoryParams.length + 1;
    const allParams = [...categoryParams, `%${location}%`];

    // Check cache for matching businesses
    const countQuery = `
      SELECT COUNT(*) as cached_count
      FROM businesses
      WHERE
        ${categoryClause}
        AND (LOWER(city) LIKE LOWER($${locationParam}) OR LOWER(address) LIKE LOWER($${locationParam}))
    `;

    console.log('[Cache Detection] Query:', { category, location, countQuery, params: allParams });

    const result = await db.query(countQuery, allParams);
    const cachedCount = result.rows.length > 0 ? parseInt(result.rows[0].cached_count) : 0;

    console.log('[Cache Detection] Found:', cachedCount, 'businesses');

    // Calculate cost comparison
    const searchCost = 0.50; // Approximate Apify cost for 200 businesses
    const cachedCost = 0.00;
    const savings = searchCost;

    // Get sample businesses for preview
    let sampleBusinesses = [];
    if (cachedCount > 0) {
      const sampleQuery = `
        SELECT
          name,
          address,
          city,
          category,
          rating,
          reviews_count,
          place_id
        FROM businesses
        WHERE
          ${categoryClause}
          AND (LOWER(city) LIKE LOWER($${locationParam}) OR LOWER(address) LIKE LOWER($${locationParam}))
        LIMIT 5
      `;

      const sampleResult = await db.query(sampleQuery, allParams);
      sampleBusinesses = sampleResult.rows;
    }

    return NextResponse.json({
      hasCached: cachedCount > 0,
      cachedCount,
      sampleBusinesses,
      costComparison: {
        searchNew: searchCost,
        useCached: cachedCost,
        savings: savings,
        savingsPercent: cachedCount > 0 ? 100 : 0
      },
      recommendation: cachedCount > 0 ? 'cached' : 'search'
    });

  } catch (error: any) {
    console.error('Cache check error:', error);
    return NextResponse.json(
      { error: 'Failed to check cache', details: error.message },
      { status: 500 }
    );
  }
}
