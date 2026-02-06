import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { requireRole } from '@/lib/auth-helpers'
import { z } from 'zod'
import { auth } from '@/auth'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

const importBusinessSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  city: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url('Invalid URL').or(z.literal('')).optional(),
  rating: z.number().min(0).max(5).optional(),
  total_reviews: z.number().int().min(0).optional(),
})

const importRequestSchema = z.object({
  businesses: z.array(importBusinessSchema).min(1, 'At least one business is required'),
})

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'va'])
    const session = await auth()
    const body = await request.json()
    const { businesses } = importRequestSchema.parse(body)

    const results = []

    for (let i = 0; i < businesses.length; i++) {
      const business = businesses[i]
      try {
        // Insert business
        const result = await pool.query(
          `INSERT INTO businesses (
            business_name,
            city,
            country,
            address,
            phone,
            website,
            rating,
            total_reviews,
            lifecycle_stage,
            data_source,
            entry_method,
            enrichment_priority,
            qualification_date,
            qualified_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, $13)
          RETURNING *`,
          [
            business.business_name,
            business.city || null,
            business.country || null,
            business.address || null,
            business.phone || null,
            business.website || null,
            business.rating || null,
            business.total_reviews || null,
            'lead',
            'import',
            'csv_import',
            50, // default priority
            session?.user?.id || null,
          ]
        )

        const newBusiness = result.rows[0]

        // Log activity
        await pool.query(
          'SELECT log_lead_activity($1, $2, $3, $4, $5, $6)',
          [
            newBusiness.id,
            session?.user?.id || null,
            'imported',
            null,
            JSON.stringify(newBusiness),
            'Business imported via CSV',
          ]
        )

        results.push({
          success: true,
          row: i + 2, // +2 because row 1 is headers, and i starts at 0
          business_name: business.business_name,
        })
      } catch (error) {
        console.error(`Error importing business ${i + 1}:`, error)
        results.push({
          success: false,
          row: i + 2,
          business_name: business.business_name,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const errorCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: errorCount === 0,
      imported: successCount,
      failed: errorCount,
      results,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error importing businesses:', error)
    return NextResponse.json(
      { error: 'Failed to import businesses' },
      { status: 500 }
    )
  }
}
