/**
 * Database Reviews API
 * View reviews directly from PostgreSQL cache without re-scraping
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../database/db';

/**
 * GET /api/database/reviews
 * Query reviews from database with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Filters
    const category = searchParams.get('category');
    const city = searchParams.get('city');
    const maxRating = searchParams.get('maxRating') ? parseInt(searchParams.get('maxRating')!) : 3;
    const dayLimit = searchParams.get('dayLimit') ? parseInt(searchParams.get('dayLimit')!) : 30;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;

    // Build query
    let conditions: string[] = ['1=1'];
    let params: any[] = [];
    let paramIndex = 1;

    // Filter by business city/category
    if (city) {
      conditions.push(`b.city ILIKE $${paramIndex}`);
      params.push(`%${city}%`);
      paramIndex++;
    }

    if (category) {
      conditions.push(`b.category ILIKE $${paramIndex}`);
      params.push(`%${category}%`);
      paramIndex++;
    }

    // Filter by review rating
    conditions.push(`r.rating <= $${paramIndex}`);
    params.push(maxRating);
    paramIndex++;

    // Filter by review date (use parameterized query for safety)
    conditions.push(`r.published_date >= NOW() - INTERVAL '1 day' * $${paramIndex}`);
    params.push(dayLimit);
    paramIndex++;

    const query = `
      SELECT
        r.id,
        r.review_id,
        r.reviewer_name,
        r.rating,
        r.text,
        r.published_date,
        r.extracted_at,
        r.language,
        b.id as business_id,
        b.name as business_name,
        b.place_id,
        b.address,
        b.city,
        b.category,
        b.rating as business_rating,
        b.reviews_count as business_reviews_count,
        b.phone,
        b.website,
        b.google_maps_url
      FROM reviews r
      JOIN businesses b ON r.business_id = b.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.published_date DESC, r.rating ASC
      LIMIT $${paramIndex}
    `;

    params.push(limit);

    console.log('🔍 Query:', query);
    console.log('📊 Params:', params);

    const result = await db.query(query, params);

    // Group reviews by business
    const businessMap = new Map();

    result.rows.forEach((row) => {
      const businessId = row.business_id;

      if (!businessMap.has(businessId)) {
        businessMap.set(businessId, {
          id: businessId,
          placeId: row.place_id,
          title: row.business_name,
          address: row.address,
          city: row.city,
          categoryName: row.category || 'Unknown',
          totalScore: parseFloat(row.business_rating) || 0,
          reviewsCount: row.business_reviews_count || 0,
          phone: row.phone,
          website: row.website,
          url: row.google_maps_url,
          reviews: []
        });
      }

      businessMap.get(businessId).reviews.push({
        id: row.id,
        reviewId: row.review_id,
        name: row.reviewer_name,
        stars: row.rating,
        text: row.text,
        publishedAtDate: row.published_date,
        originalLanguage: row.language || 'unknown',
        // Include business info for context
        title: row.business_name,
        placeId: row.place_id,
        totalScore: parseFloat(row.business_rating)
      });
    });

    const businesses = Array.from(businessMap.values());
    const reviews = result.rows.map(row => ({
      id: row.id,
      reviewId: row.review_id,
      name: row.reviewer_name,
      stars: row.rating,
      text: row.text,
      publishedAtDate: row.published_date,
      originalLanguage: row.language || 'unknown',
      // Business information
      title: row.business_name,
      placeId: row.place_id,
      address: row.address,
      city: row.city,
      totalScore: parseFloat(row.business_rating),
      categoryName: row.category || 'Unknown'
    }));

    return NextResponse.json({
      success: true,
      data: {
        businesses,
        reviews,
        stats: {
          total_businesses: businesses.length,
          total_reviews: reviews.length,
          filters: {
            category,
            city,
            maxRating,
            dayLimit,
            limit
          }
        }
      }
    });

  } catch (error: any) {
    console.error('Database reviews query error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
