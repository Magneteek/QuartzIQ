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

    // Import the LinkedIn extractor (using require for compatibility)
    const { UniversalBusinessReviewExtractor } = await import('../../../../../../universal-business-review-extractor.js')

    const extractor = new UniversalBusinessReviewExtractor()

    console.log(`🔗 LinkedIn enrichment requested for ${businesses.length} businesses`)

    // Configure enrichment options
    const enrichmentOptions = {
      maxBusinesses: options.maxBusinesses || 5,
      includePhones: options.includePhones !== false,
      prioritizeEmails: options.prioritizeEmails !== false,
      ...options
    }

    // Stream the enrichment process for real-time updates
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial progress
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'progress',
            step: 'Initializing LinkedIn executive search...',
            progress: 0
          }) + '\n'))

          // Perform LinkedIn enrichment
          const result = await extractor.enrichWithLinkedInExecutives(businesses, enrichmentOptions)

          // Send progress updates
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'progress',
            step: 'LinkedIn enrichment completed',
            progress: 100
          }) + '\n'))

          // Send final result
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'result',
            result: {
              success: true,
              enrichedBusinesses: result.enrichedBusinesses,
              enrichmentSummary: result.enrichmentSummary,
              originalCount: result.originalBusinesses.length,
              enrichedCount: result.enrichedBusinesses.length,
              newEmailsFound: result.enrichmentSummary.newExecutiveEmails,
              successRate: result.enrichmentSummary.successRate,
              costEstimate: result.enrichmentSummary.costEstimate,
              processingDate: new Date()
            }
          }) + '\n'))

          controller.close()
        } catch (error) {
          console.error('LinkedIn enrichment error:', error)

          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'LinkedIn enrichment failed'
          }) + '\n'))

          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })

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