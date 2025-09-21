import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

interface ReviewData {
  [key: string]: string | number | boolean
}

interface ExportRequest {
  format: string
  fields: string[]
  data: {
    reviews?: ReviewData[]
    businesses?: ReviewData[]
    searchCriteria: Record<string, unknown>
    extractionDate: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const { format, fields, data }: ExportRequest = await request.json()

    if (!format || !fields || !data) {
      return NextResponse.json(
        { error: 'Format, fields, and data are required' },
        { status: 400 }
      )
    }

    // Determine which data to export (reviews or businesses)
    const sourceData = data.businesses || data.reviews || []
    const dataType = data.businesses ? 'businesses' : 'reviews'

    // Filter data to only include selected fields
    const filteredData = sourceData.map((item: ReviewData) => {
      const filtered: Record<string, string | number | boolean> = {}
      fields.forEach((field: string) => {
        // Handle nested fields like socialMedia.facebook
        if (field.includes('.')) {
          const [parent, child] = field.split('.')
          const parentObj = item[parent] as Record<string, any>
          filtered[field] = parentObj?.[child] || ''
        } else {
          filtered[field] = item[field] || ''
        }
      })
      return filtered
    })

    let responseData: Buffer
    let contentType: string
    let filename: string

    switch (format) {
      case 'json':
        responseData = Buffer.from(JSON.stringify({
          metadata: {
            exportDate: new Date().toISOString(),
            totalRecords: filteredData.length,
            dataType: dataType,
            searchCriteria: data.searchCriteria,
            extractionDate: data.extractionDate
          },
          [dataType]: filteredData
        }, null, 2))
        contentType = 'application/json'
        filename = dataType === 'businesses' ? 'business-contacts.json' : 'business-reviews.json'
        break

      case 'csv':
        // Create CSV header
        const csvHeader = fields.join(',')

        // Create CSV rows
        const csvRows = filteredData.map((row: Record<string, string | number | boolean>) => {
          return fields.map((field: string) => {
            const value = row[field] || ''
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`
            }
            return value
          }).join(',')
        })

        const csvContent = [csvHeader, ...csvRows].join('\n')
        responseData = Buffer.from(csvContent)
        contentType = 'text/csv'
        filename = dataType === 'businesses' ? 'business-contacts.csv' : 'business-reviews.csv'
        break

      case 'excel':
        // Create worksheet data
        const wsData = [
          fields, // Header row
          ...filteredData.map((row: Record<string, string | number | boolean>) => fields.map((field: string) => row[field] || ''))
        ]

        // Create workbook
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet(wsData)

        // Auto-size columns
        const colWidths = fields.map((field: string) => {
          const maxLength = Math.max(
            field.length,
            ...filteredData.map((row: Record<string, string | number | boolean>) => String(row[field] || '').length)
          )
          return { wch: Math.min(maxLength + 2, 50) }
        })
        ws['!cols'] = colWidths

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Reviews')

        // Generate buffer
        responseData = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        filename = dataType === 'businesses' ? 'business-contacts.xlsx' : 'business-reviews.xlsx'
        break

      default:
        return NextResponse.json(
          { error: 'Unsupported format' },
          { status: 400 }
        )
    }

    // Create response with appropriate headers
    return new NextResponse(new Uint8Array(responseData), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': responseData.length.toString(),
      },
    })

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    )
  }
}