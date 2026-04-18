/**
 * POST /api/businesses/[id]/refresh-from-google
 *
 * Fetches fresh data from Google Maps for a specific business using Apify.
 * Uses place_id if available, falls back to business name + city search.
 * Updates: address, city, country_code, phone, website, category, rating,
 *          reviews_count, place_id, google_maps_url, latitude, longitude
 */

import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

const APIFY_TOKEN = process.env.APIFY_API_TOKEN

async function runApifyForBusiness(placeId: string | null, name: string, city: string | null): Promise<Record<string, unknown> | null> {
  let input: Record<string, unknown>

  if (placeId && !placeId.startsWith('ghl_')) {
    // Direct place_id lookup via startUrls
    input = {
      startUrls: [{ url: `https://www.google.com/maps/place/?q=place_id:${placeId}` }],
      maxCrawledPlacesPerSearch: 1,
      language: 'en',
      includeImages: false,
      includeReviews: false,
    }
  } else {
    // Fallback: search by name + city
    const searchQuery = city ? `${name} ${city}` : name
    input = {
      searchStringsArray: [searchQuery],
      maxCrawledPlacesPerSearch: 1,
      language: 'en',
      includeImages: false,
      includeReviews: false,
    }
  }

  const url = `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(130000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Apify error ${res.status}: ${text.slice(0, 200)}`)
  }

  const items = await res.json()
  return items?.[0] || null
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: 'Apify token not configured' }, { status: 500 })
  }

  // Get current business record
  const existing = await pool.query(
    'SELECT id, name, city, place_id, data_source FROM businesses WHERE id = $1',
    [id]
  )

  if (existing.rows.length === 0) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const biz = existing.rows[0]

  let item: Record<string, unknown> | null = null
  try {
    item = await runApifyForBusiness(biz.place_id, biz.name, biz.city)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Apify failed: ${msg}` }, { status: 502 })
  }

  if (!item) {
    return NextResponse.json({ error: 'No results found on Google Maps' }, { status: 404 })
  }

  // Map Apify result to DB columns — only overwrite if value is present
  const location = item.location as Record<string, unknown> | undefined
  const updates: Record<string, unknown> = {}

  if (item.address)      updates.address      = item.address
  if (item.city)         updates.city         = item.city
  if (item.state)        updates.state        = item.state
  if (item.postalCode)   updates.postal_code  = item.postalCode
  if (item.countryCode)  updates.country_code = (item.countryCode as string).toLowerCase()
  if (item.phone)        updates.phone        = item.phone
  if (item.website)      updates.website      = item.website
  if (item.categoryName) updates.category     = item.categoryName
  if (item.totalScore)   updates.rating       = item.totalScore
  if (item.reviewsCount) updates.reviews_count = item.reviewsCount
  if (item.placeId) {
    updates.place_id = item.placeId
    const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${item.placeId}`
    updates.google_maps_url = mapsUrl
    updates.google_profile_url = mapsUrl
  }
  if (item.permanentlyClosed !== undefined) updates.permanently_closed = item.permanentlyClosed
  if (location?.lat)     updates.latitude     = location.lat
  if (location?.lng)     updates.longitude    = location.lng

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true, message: 'No new data found', updated: 0 })
  }

  // Build dynamic UPDATE query
  const setClauses = Object.keys(updates).map((col, i) => `${col} = $${i + 2}`)
  const values = [id, ...Object.values(updates)]
  setClauses.push('last_scraped_at = NOW()', 'last_updated_at = NOW()')

  await pool.query(
    `UPDATE businesses SET ${setClauses.join(', ')} WHERE id = $1`,
    values
  )

  return NextResponse.json({
    success: true,
    message: `Updated ${Object.keys(updates).length} fields`,
    updated: Object.keys(updates).length,
    fields: Object.keys(updates),
    businessName: item.title || biz.name,
  })
}
