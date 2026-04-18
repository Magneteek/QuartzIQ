import { NextRequest, NextResponse } from 'next/server'
import { query } from '../../../../database/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 200)

    const result = await query(
      `SELECT id, category, location, country_code, businesses_found, status, lat, lng, zoom, created_at
       FROM search_sessions
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    )

    return NextResponse.json({ success: true, sessions: result.rows })
  } catch (error: any) {
    console.error('search-sessions GET error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { category, location, countryCode, businessesFound, lat, lng, zoom } = body

    if (!category || !location) {
      return NextResponse.json({ error: 'category and location are required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO search_sessions (category, location, country_code, businesses_found, lat, lng, zoom)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [category, location, countryCode || null, businessesFound || 0, lat || null, lng || null, zoom || null]
    )

    return NextResponse.json({ success: true, id: result.rows[0].id })
  } catch (error: any) {
    console.error('search-sessions POST error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
