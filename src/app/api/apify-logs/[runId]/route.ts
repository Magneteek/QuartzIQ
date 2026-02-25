import { NextRequest, NextResponse } from 'next/server'

const APIFY_API_BASE = 'https://api.apify.com/v2'
const APIFY_TOKEN = process.env.APIFY_API_TOKEN

/**
 * GET /api/apify-logs/[runId]
 * Fetches real-time logs from Apify actor run
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params

    if (!runId) {
      return NextResponse.json(
        { error: 'Run ID is required' },
        { status: 400 }
      )
    }

    if (!APIFY_TOKEN) {
      return NextResponse.json(
        { error: 'Apify API token not configured' },
        { status: 500 }
      )
    }

    // Fetch logs from Apify
    const response = await fetch(`${APIFY_API_BASE}/actor-runs/${runId}/log`, {
      headers: {
        'Authorization': `Bearer ${APIFY_TOKEN}`
      }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch logs: ${response.statusText}` },
        { status: response.status }
      )
    }

    const logs = await response.text()

    return NextResponse.json({
      success: true,
      logs,
      runId
    })
  } catch (error) {
    console.error('Error fetching Apify logs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch logs' },
      { status: 500 }
    )
  }
}
