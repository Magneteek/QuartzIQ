import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

/**
 * GET /api/organizations/default
 * Returns the default organization ID, creating one if none exists.
 * This app is single-tenant — there's always exactly one org.
 */
export async function GET() {
  try {
    // Try to get the first org
    const result = await pool.query(
      `SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1`
    )

    if (result.rows.length > 0) {
      return NextResponse.json({ id: result.rows[0].id })
    }

    // No org exists — create a default one
    const insert = await pool.query(
      `INSERT INTO organizations (name, slug, subscription_tier, monthly_extraction_limit)
       VALUES ('QuartzIQ', 'quartziq', 'enterprise', 999999)
       RETURNING id`
    )

    return NextResponse.json({ id: insert.rows[0].id })
  } catch (error) {
    console.error('[organizations/default] Error:', error)
    return NextResponse.json({ error: 'Failed to get organization' }, { status: 500 })
  }
}
