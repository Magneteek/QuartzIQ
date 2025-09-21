import { NextRequest, NextResponse } from 'next/server'
import { HistoryManager } from '../../../lib/history-manager'

const historyManager = new HistoryManager()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'list':
        const index = await historyManager.getIndex()
        return NextResponse.json({ success: true, data: index })

      case 'search':
        const filters = {
          category: searchParams.get('category') || undefined,
          location: searchParams.get('location') || undefined,
          countryCode: searchParams.get('countryCode') || undefined,
          dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined,
          dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined
        }
        const filtered = await historyManager.searchHistory(filters)
        return NextResponse.json({ success: true, data: filtered })

      case 'stats':
        const stats = await historyManager.getStorageStats()
        return NextResponse.json({ success: true, data: stats })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: list, search, stats' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('History API GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'save':
        const { searchCriteria, results, extractionTime } = data
        const id = await historyManager.saveExtraction(searchCriteria, results, extractionTime)
        return NextResponse.json({ success: true, data: { id } })

      case 'updateEnrichment':
        const { id: extractionId, enrichedBusinesses, enrichmentStats } = data
        await historyManager.updateEnrichment(extractionId, enrichedBusinesses, enrichmentStats)
        return NextResponse.json({ success: true, message: 'Enrichment updated' })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: save, updateEnrichment' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('History API POST error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Extraction ID is required' },
        { status: 400 }
      )
    }

    await historyManager.deleteExtraction(id)
    return NextResponse.json({ success: true, message: 'Extraction deleted' })

  } catch (error: any) {
    console.error('History API DELETE error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}