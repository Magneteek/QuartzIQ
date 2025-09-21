import { NextRequest, NextResponse } from 'next/server'
import { HistoryManager } from '../../../../lib/history-manager'

const historyManager = new HistoryManager()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Extraction ID is required' },
        { status: 400 }
      )
    }

    const extraction = await historyManager.loadExtraction(id)

    if (!extraction) {
      return NextResponse.json(
        { success: false, error: 'Extraction not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: extraction })

  } catch (error: any) {
    console.error(`History load error for ${params.id}:`, error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}