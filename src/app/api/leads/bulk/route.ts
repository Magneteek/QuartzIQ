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

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one ID is required'),
})

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one ID is required'),
  updates: z.object({
    ready_for_enrichment: z.boolean().optional(),
    enrichment_priority: z.number().int().min(0).max(100).optional(),
    data_source: z.enum(['manual', 'scraper', 'import']).optional(),
  }),
})

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'va'])
    const session = await auth()
    const body = await request.json()
    const action = body.action

    switch (action) {
      case 'delete': {
        const { ids } = bulkDeleteSchema.parse(body)

        // Get businesses for activity log
        const businessesResult = await pool.query(
          'SELECT * FROM businesses WHERE id = ANY($1)',
          [ids]
        )

        // Log deletions
        for (const business of businessesResult.rows) {
          await pool.query(
            'SELECT log_lead_activity($1, $2, $3, $4, $5, $6)',
            [
              business.id,
              session?.user?.id || null,
              'bulk_deleted',
              JSON.stringify(business),
              null,
              `Bulk deleted ${ids.length} businesses`,
            ]
          )
        }

        // Delete businesses (will cascade to reviews and activity log)
        const result = await pool.query(
          'DELETE FROM businesses WHERE id = ANY($1)',
          [ids]
        )

        return NextResponse.json({
          success: true,
          deleted: result.rowCount,
        })
      }

      case 'update': {
        const { ids, updates } = bulkUpdateSchema.parse(body)

        // Build update query dynamically
        const updateParts: string[] = []
        const values: any[] = []
        let paramIndex = 1

        Object.entries(updates).forEach(([key, value]) => {
          if (value !== undefined) {
            updateParts.push(`${key} = $${paramIndex}`)
            values.push(value)
            paramIndex++
          }
        })

        if (updateParts.length === 0) {
          return NextResponse.json(
            { error: 'No fields to update' },
            { status: 400 }
          )
        }

        updateParts.push(`updated_at = CURRENT_TIMESTAMP`)
        values.push(ids)

        const updateQuery = `
          UPDATE businesses
          SET ${updateParts.join(', ')}
          WHERE id = ANY($${paramIndex})
          RETURNING *
        `

        const result = await pool.query(updateQuery, values)

        // Log bulk update
        for (const business of result.rows) {
          await pool.query(
            'SELECT log_lead_activity($1, $2, $3, $4, $5, $6)',
            [
              business.id,
              session?.user?.id || null,
              'bulk_updated',
              null,
              JSON.stringify(updates),
              `Bulk updated ${ids.length} businesses`,
            ]
          )
        }

        return NextResponse.json({
          success: true,
          updated: result.rowCount,
        })
      }

      case 'export': {
        const { ids } = z
          .object({
            ids: z.array(z.string().uuid()).optional(),
          })
          .parse(body)

        // If no IDs provided, export all leads
        const query = ids
          ? 'SELECT * FROM get_leads_for_va($1, $2, $3, $4, $5) WHERE id = ANY($6)'
          : 'SELECT * FROM get_leads_for_va($1, $2, $3, $4, $5)'

        const params = ids
          ? [10000, 0, null, 'business_name', 'ASC', ids]
          : [10000, 0, null, 'business_name', 'ASC']

        const result = await pool.query(query, params)

        // Convert to CSV
        const leads = result.rows
        if (leads.length === 0) {
          return NextResponse.json(
            { error: 'No leads to export' },
            { status: 400 }
          )
        }

        // CSV headers
        const headers = [
          'business_name',
          'city',
          'country',
          'address',
          'phone',
          'website',
          'rating',
          'total_reviews',
          'place_id',
          'data_source',
          'qualification_date',
          'qualified_by_name',
          'ready_for_enrichment',
          'review_count',
        ]

        // CSV rows
        const csvRows = [
          headers.join(','),
          ...leads.map((lead: any) =>
            headers
              .map((header) => {
                const value = lead[header]
                if (value === null || value === undefined) return ''
                // Escape commas and quotes
                const stringValue = String(value)
                if (stringValue.includes(',') || stringValue.includes('"')) {
                  return `"${stringValue.replace(/"/g, '""')}"`
                }
                return stringValue
              })
              .join(',')
          ),
        ]

        const csv = csvRows.join('\n')

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="leads-export-${new Date().toISOString().split('T')[0]}.csv"`,
          },
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error in bulk operation:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    )
  }
}
