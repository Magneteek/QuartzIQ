import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../database/db'

export async function GET(request: NextRequest) {
  try {
    // Check what categories exist for dentists
    const categories = await db.query(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM businesses
      WHERE category ILIKE '%dent%' OR category ILIKE '%tand%'
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `)

    // Check Amsterdam businesses
    const cities = await db.query(`
      SELECT DISTINCT city, category, country_code, COUNT(*) as count
      FROM businesses
      WHERE city ILIKE '%Amsterdam%'
      GROUP BY city, category, country_code
      ORDER BY count DESC
      LIMIT 10
    `)

    // Sample a few actual records
    const sample = await db.query(`
      SELECT name, category, city, country_code, rating, reviews_count
      FROM businesses
      WHERE (category ILIKE '%dent%' OR category ILIKE '%tand%')
      LIMIT 5
    `)

    // Try the exact cache query that's failing
    const cacheQuery = await db.query(`
      SELECT name, category, city, country_code, rating, reviews_count
      FROM businesses
      WHERE category ILIKE $1 AND city ILIKE $2 AND UPPER(country_code) = UPPER($3)
      LIMIT 5
    `, ['%dentist%', '%Amsterdam%', 'nl'])

    return NextResponse.json({
      dentistCategories: categories.rows,
      amsterdamBusinesses: cities.rows,
      sampleDentists: sample.rows,
      cacheQueryResult: cacheQuery.rows,
      cacheQueryCount: cacheQuery.rows.length
    })

  } catch (error: any) {
    console.error('Debug query error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
