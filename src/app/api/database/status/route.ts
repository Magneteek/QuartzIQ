/**
 * Database Connection Status API
 * Returns cache statistics and connection health
 *
 * ✨ Updated with structured logging and error handling
 */

import { NextResponse } from 'next/server';
import { db } from '../../../../../database/db';
import { asyncHandler } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import { DatabaseError } from '@/lib/errors';

// Create module-specific logger
const statusLogger = logger.child({ module: 'database-status' });

export const GET = asyncHandler(async () => {
  statusLogger.info('Database status check requested');
  const timer = statusLogger.time('status-check');

  // Test database connection with a simple query
  const result = await db.query(`
    SELECT
      COUNT(*) as total_businesses,
      COUNT(DISTINCT category) as total_categories,
      COUNT(DISTINCT city) as total_cities,
      (COUNT(*) * 0.03) as cache_value_usd
    FROM businesses
  `);

  if (!result.rows[0]) {
    throw new DatabaseError('No statistics returned from database', {
      query: 'business_stats',
    });
  }

  // Get top categories
  const topCategories = await db.query(`
    SELECT category, COUNT(*) as count
    FROM businesses
    GROUP BY category
    ORDER BY count DESC
    LIMIT 5
  `);

  // Get top cities
  const topCities = await db.query(`
    SELECT city, COUNT(*) as count
    FROM businesses
    GROUP BY city
    ORDER BY count DESC
    LIMIT 5
  `);

  const stats = result.rows[0];
  const response = {
    connected: true,
    database: {
      total_businesses: parseInt(stats.total_businesses),
      total_categories: parseInt(stats.total_categories),
      total_cities: parseInt(stats.total_cities),
      cache_value_usd: parseFloat(stats.cache_value_usd).toFixed(2),
    },
    top_categories: topCategories.rows.map((r: any) => ({
      name: r.category,
      count: parseInt(r.count),
    })),
    top_cities: topCities.rows.map((r: any) => ({
      name: r.city,
      count: parseInt(r.count),
    })),
    last_checked: new Date().toISOString(),
  };

  // Log business metrics
  statusLogger.info('Database status retrieved', {
    total_businesses: response.database.total_businesses,
    cache_value_usd: response.database.cache_value_usd,
  });

  timer.end();

  return NextResponse.json(response);
});
