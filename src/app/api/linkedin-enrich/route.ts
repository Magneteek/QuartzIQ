import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { businesses, options = {} } = await request.json()

    if (!businesses || !Array.isArray(businesses)) {
      return NextResponse.json(
        { error: 'Invalid businesses data' },
        { status: 400 }
      )
    }

    // LinkedIn extractor import disabled for build stability
    console.log(`⚠️ LinkedIn extractor disabled for build stability`)
    throw new Error('LinkedIn extractor not available in API runtime context')

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'LinkedIn Executive Email Enrichment API',
    endpoint: '/api/linkedin-enrich',
    method: 'POST',
    description: 'Enriches business data with LinkedIn executive emails',
    costPerBusiness: '$0.01-0.05',
    expectedImprovement: '10-15x more executive emails'
  })
}