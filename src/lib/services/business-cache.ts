/**
 * Business Cache Service
 * Handles business deduplication and placeID caching
 * CRITICAL: This saves $$ by preventing re-crawling Google Maps
 */

import { db, query, transaction } from '../../../database/db';
import { PoolClient } from 'pg';

export interface CachedBusiness {
  id: string;
  place_id: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  rating: number | null;
  reviews_count: number;
  google_maps_url: string | null;
  status: string;
  last_scraped_at: Date | null;
  scrape_count: number;
  raw_data: any;
}

export interface BusinessSearchResult {
  cached: CachedBusiness[];
  needsCrawl: string[]; // Place IDs not in cache
  stats: {
    totalRequested: number;
    foundInCache: number;
    needsCrawl: number;
    cacheHitRate: number;
  };
}

class BusinessCacheService {
  /**
   * Find businesses by placeIDs (use cache first)
   * COST SAVINGS: Avoids expensive Google Maps API calls
   */
  async findByPlaceIds(placeIds: string[]): Promise<BusinessSearchResult> {
    const result = await query<CachedBusiness>(`
      SELECT *
      FROM businesses
      WHERE place_id = ANY($1::varchar[])
    `, [placeIds]);

    const cachedPlaceIds = new Set(result.rows.map(b => b.place_id));
    const needsCrawl = placeIds.filter(id => !cachedPlaceIds.has(id));

    const stats = {
      totalRequested: placeIds.length,
      foundInCache: result.rows.length,
      needsCrawl: needsCrawl.length,
      cacheHitRate: result.rows.length / placeIds.length
    };

    console.log(`💾 Cache hit: ${stats.foundInCache}/${stats.totalRequested} (${(stats.cacheHitRate * 100).toFixed(1)}%)`);

    if (stats.cacheHitRate > 0) {
      console.log(`💰 Saved ~$${(stats.foundInCache * 0.03).toFixed(2)} in Google Maps API costs`);
    }

    return {
      cached: result.rows,
      needsCrawl,
      stats
    };
  }

  /**
   * Find duplicate business using fingerprint
   * Prevents processing same business twice
   */
  async findDuplicate(
    placeId: string | null,
    name: string,
    address: string | null,
    phone: string | null
  ): Promise<string | null> {
    const result = await query<{ find_duplicate_business: string }>(`
      SELECT find_duplicate_business($1, $2, $3, $4) as business_id
    `, [placeId, name, address, phone]);

    return result.rows[0]?.business_id || null;
  }

  /**
   * Upsert business (insert or update if exists)
   * Returns business ID
   */
  async upsert(business: {
    place_id: string;
    name: string;
    category?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    state?: string;
    country_code?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
    website?: string;
    email?: string;
    rating?: number;
    reviews_count?: number;
    status?: string;
    permanently_closed?: boolean;
    google_maps_url?: string;
    raw_data?: any;
  }): Promise<string> {
    return await transaction(async (client: PoolClient) => {
      // First check if business exists
      const existing = await this.findDuplicate(
        business.place_id,
        business.name,
        business.address || null,
        business.phone || null
      );

      if (existing) {
        // Update existing business
        await client.query(`
          UPDATE businesses SET
            name = $2,
            category = COALESCE($3, category),
            address = COALESCE($4, address),
            city = COALESCE($5, city),
            postal_code = COALESCE($6, postal_code),
            state = COALESCE($7, state),
            country_code = COALESCE($8, country_code),
            latitude = COALESCE($9, latitude),
            longitude = COALESCE($10, longitude),
            phone = COALESCE($11, phone),
            website = COALESCE($12, website),
            email = COALESCE($13, email),
            rating = COALESCE($14, rating),
            reviews_count = COALESCE($15, reviews_count),
            status = COALESCE($16, status),
            permanently_closed = COALESCE($17, permanently_closed),
            google_maps_url = COALESCE($18, google_maps_url),
            raw_data = COALESCE($19::jsonb, raw_data),
            last_updated_at = NOW(),
            last_scraped_at = NOW(),
            scrape_count = scrape_count + 1
          WHERE id = $1
        `, [
          existing,
          business.name,
          business.category,
          business.address,
          business.city,
          business.postal_code,
          business.state,
          business.country_code,
          business.latitude,
          business.longitude,
          business.phone,
          business.website,
          business.email,
          business.rating,
          business.reviews_count,
          business.status,
          business.permanently_closed,
          business.google_maps_url,
          business.raw_data ? JSON.stringify(business.raw_data) : null
        ]);

        console.log(`🔄 Updated cached business: ${business.name}`);
        return existing;
      } else {
        // Insert new business
        const result = await client.query<{ id: string }>(`
          INSERT INTO businesses (
            place_id, name, category, address, city, postal_code, state, country_code,
            latitude, longitude, phone, website, email, rating, reviews_count,
            status, permanently_closed, google_maps_url, raw_data,
            last_scraped_at, scrape_count
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19::jsonb, NOW(), 1
          )
          RETURNING id
        `, [
          business.place_id,
          business.name,
          business.category || null,
          business.address || null,
          business.city || null,
          business.postal_code || null,
          business.state || null,
          business.country_code || 'nl',
          business.latitude || null,
          business.longitude || null,
          business.phone || null,
          business.website || null,
          business.email || null,
          business.rating || null,
          business.reviews_count || 0,
          business.status || 'active',
          business.permanently_closed || false,
          business.google_maps_url || null,
          business.raw_data ? JSON.stringify(business.raw_data) : null
        ]);

        console.log(`✨ Cached new business: ${business.name}`);
        return result.rows[0].id;
      }
    });
  }

  /**
   * Batch upsert businesses
   * More efficient for multiple businesses
   */
  async upsertBatch(businesses: any[]): Promise<string[]> {
    const businessIds: string[] = [];

    for (const business of businesses) {
      const id = await this.upsert(business);
      businessIds.push(id);
    }

    console.log(`💾 Cached ${businesses.length} businesses`);
    return businessIds;
  }

  /**
   * Get businesses that need review update
   * Returns businesses last scraped > X days ago
   */
  async getStaleBusinesses(daysSinceLastScrape: number = 7, limit: number = 100): Promise<CachedBusiness[]> {
    const result = await query<CachedBusiness>(`
      SELECT *
      FROM businesses
      WHERE last_scraped_at < NOW() - INTERVAL '${daysSinceLastScrape} days'
         OR last_scraped_at IS NULL
      ORDER BY last_scraped_at ASC NULLS FIRST
      LIMIT $1
    `, [limit]);

    return result.rows;
  }

  /**
   * Search businesses by location and category
   * Useful for finding cached businesses for monitoring
   */
  async searchCached(filters: {
    category?: string;
    city?: string;
    country_code?: string;
    min_rating?: number;
    max_rating?: number;
    min_reviews?: number;
    limit?: number;
  }): Promise<CachedBusiness[]> {
    let conditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (filters.category) {
      conditions.push(`category ILIKE $${paramIndex}`);
      params.push(`%${filters.category}%`);
      paramIndex++;
    }

    if (filters.city) {
      conditions.push(`city ILIKE $${paramIndex}`);
      params.push(`%${filters.city}%`);
      paramIndex++;
    }

    if (filters.country_code) {
      conditions.push(`UPPER(country_code) = UPPER($${paramIndex})`);
      params.push(filters.country_code);
      paramIndex++;
    }

    if (filters.min_rating !== undefined) {
      conditions.push(`rating >= $${paramIndex}`);
      params.push(filters.min_rating);
      paramIndex++;
    }

    if (filters.max_rating !== undefined) {
      conditions.push(`rating <= $${paramIndex}`);
      params.push(filters.max_rating);
      paramIndex++;
    }

    if (filters.min_reviews !== undefined) {
      conditions.push(`reviews_count >= $${paramIndex}`);
      params.push(filters.min_reviews);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = `LIMIT $${paramIndex}`;
    params.push(filters.limit || 100);

    const sql = `
      SELECT *
      FROM businesses
      ${whereClause}
      ORDER BY rating ASC, reviews_count DESC
      ${limitClause}
    `;

    // 🔍 DEBUG: Log the actual query being executed
    console.log('\n🔍 Cache Search Query:');
    console.log('   SQL:', sql.replace(/\s+/g, ' ').trim());
    console.log('   Params:', JSON.stringify(params));
    console.log('   Filters:', JSON.stringify(filters));

    const result = await query<CachedBusiness>(sql, params);

    console.log(`   Results: ${result.rows.length} businesses found\n`);

    return result.rows;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    total_businesses: number;
    total_reviews: number;
    avg_scrape_count: number;
    never_scraped: number;
    scraped_last_7_days: number;
    scraped_last_30_days: number;
    by_country: Array<{ country: string; count: number }>;
    by_category: Array<{ category: string; count: number }>;
  }> {
    const stats = await query(`
      SELECT
        COUNT(*) as total_businesses,
        (SELECT COUNT(*) FROM reviews) as total_reviews,
        ROUND(AVG(scrape_count), 2) as avg_scrape_count,
        COUNT(CASE WHEN last_scraped_at IS NULL THEN 1 END) as never_scraped,
        COUNT(CASE WHEN last_scraped_at >= NOW() - INTERVAL '7 days' THEN 1 END) as scraped_last_7_days,
        COUNT(CASE WHEN last_scraped_at >= NOW() - INTERVAL '30 days' THEN 1 END) as scraped_last_30_days
      FROM businesses
    `);

    const byCountry = await query(`
      SELECT country_code as country, COUNT(*) as count
      FROM businesses
      WHERE country_code IS NOT NULL
      GROUP BY country_code
      ORDER BY count DESC
      LIMIT 10
    `);

    const byCategory = await query(`
      SELECT category, COUNT(*) as count
      FROM businesses
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `);

    return {
      ...stats.rows[0],
      by_country: byCountry.rows,
      by_category: byCategory.rows
    };
  }
}

export const businessCache = new BusinessCacheService();
