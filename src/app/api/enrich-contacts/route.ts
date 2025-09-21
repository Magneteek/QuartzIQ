import { NextRequest, NextResponse } from 'next/server'
import { ContactExtractor } from '../../../lib/contact-extractor'
import { HistoryManager } from '../../../lib/history-manager'

export async function POST(request: NextRequest) {
  try {
    console.log('📨 Contact enrichment API called')
    const { businesses, extractionId, options } = await request.json()

    console.log('📊 Request data:', {
      businessesCount: businesses?.length || 0,
      businesses: businesses?.map(b => ({ title: b.title, placeId: b.placeId })) || [],
      options
    })

    // Validate required fields
    if (!businesses || !Array.isArray(businesses)) {
      console.log('❌ Validation failed: Invalid businesses array')
      return NextResponse.json(
        { error: 'Businesses array is required' },
        { status: 400 }
      )
    }

    if (businesses.length === 0) {
      console.log('❌ Validation failed: No businesses to enrich')
      return NextResponse.json(
        { error: 'No businesses provided for enrichment' },
        { status: 400 }
      )
    }

    // Set up streaming response for real-time updates
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendUpdate = (type: string, data: any) => {
          const chunk = encoder.encode(`${JSON.stringify({ type, ...data })}\n`)
          controller.enqueue(chunk)
        }

        try {
          sendUpdate('progress', {
            progress: 10,
            step: 'Initializing contact enrichment system...',
            businessesTotal: businesses.length
          })

          const extractor = new ContactExtractor()
          sendUpdate('progress', {
            progress: 20,
            step: 'Starting contact enrichment...',
            businessesTotal: businesses.length
          })

          // Configure enrichment options - simplified single method
          const enrichmentOptions = {
            maxConcurrent: options?.maxConcurrent ?? 3
          }

          sendUpdate('progress', {
            progress: 30,
            step: `Removing duplicates and searching for email addresses from business websites...`,
            businessesTotal: businesses.length
          })

          // Run contact enrichment
          const enrichedBusinesses = await extractor.enrichBusinessContacts(businesses, enrichmentOptions)

          sendUpdate('progress', {
            progress: 80,
            step: 'Processing extracted email addresses and contact data...',
            businessesTotal: businesses.length
          })

          // Calculate enrichment statistics
          const enrichedCount = enrichedBusinesses.filter(b => b.contactEnriched).length
          const phoneCount = enrichedBusinesses.filter(b => b.phone).length
          const websiteCount = enrichedBusinesses.filter(b => b.website).length
          const emailCount = enrichedBusinesses.filter(b => b.email).length

          sendUpdate('progress', {
            progress: 90,
            step: 'Finalizing results...',
            businessesTotal: businesses.length
          })

          // Check if enrichment was actually successful
          const hasAnyResults = phoneCount > 0 || websiteCount > 0 || emailCount > 0

          // Send the final results with proper status
          sendUpdate('result', {
            businesses: enrichedBusinesses,
            enrichmentStats: {
              totalBusinesses: businesses.length,
              enrichedBusinesses: enrichedCount,
              phoneNumbers: phoneCount,
              websites: websiteCount,
              emails: emailCount,
              enrichmentDate: new Date(),
              success: hasAnyResults,
              message: hasAnyResults
                ? `Successfully enriched ${enrichedCount} businesses with contact information`
                : 'Contact enrichment failed - API quota exceeded or no data available'
            }
          })

          // Save enrichment data to history if extraction ID is provided
          if (extractionId) {
            try {
              console.log(`💾 Saving enrichment data to history for extraction: ${extractionId}`)
              const historyManager = new HistoryManager()
              await historyManager.updateEnrichment(
                extractionId,
                enrichedBusinesses,
                {
                  enrichedBusinesses: enrichedCount,
                  phoneNumbers: phoneCount,
                  websites: websiteCount,
                  emails: emailCount
                }
              )
              console.log(`✅ Enrichment data saved to history successfully`)
            } catch (error: any) {
              console.error('❌ Failed to save enrichment data to history:', error.message)
              // Don't fail the entire process if history saving fails
            }
          } else {
            console.log(`⚠️ No extraction ID provided, skipping history save`)
          }

          sendUpdate('progress', {
            progress: 100,
            step: hasAnyResults
              ? `Contact enrichment completed! Found ${phoneCount} phones, ${websiteCount} websites, ${emailCount} emails`
              : 'Contact enrichment completed - No contacts found (API quota may be exceeded)',
            businessesTotal: businesses.length
          })

        } catch (error: any) {
          console.error('Contact enrichment error:', error)
          sendUpdate('error', {
            error: error.message || 'Unknown error occurred during contact enrichment',
            step: 'Contact enrichment failed'
          })
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}