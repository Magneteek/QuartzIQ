import { NextRequest, NextResponse } from 'next/server'
import { requireRoleAPI } from '@/lib/auth-helpers'
import { ContactEnrichmentOrchestrator } from '@/services/contact-enrichment-orchestrator'

/**
 * Process Enrichment Queue
 *
 * Manually triggers the enrichment processor to work through queued leads.
 * This endpoint:
 * 1. Fetches leads from enrichment_queue with status 'queued'
 * 2. For each lead:
 *    - Try Claude website research (FREE)
 *    - If needed, use Apollo API to find and enrich contacts
 * 3. Updates queue status and business enrichment_status
 * 4. Returns summary of processed jobs
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = await requireRoleAPI(['admin', 'enrichment'])
    if (error) return error

    const body = await request.json()
    const maxJobs = body.maxJobs || 10 // Default: process up to 10 jobs
    const businessIds = body.businessIds // Optional: specific businesses to process

    // Validate environment variables
    const apolloApiKey = process.env.APOLLO_API_KEY
    const claudeApiKey = process.env.ANTHROPIC_API_KEY
    const apifyApiKey = process.env.APIFY_API_TOKEN
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
    const betterEnrichApiKey = process.env.BETTER_ENRICH_API_KEY
    const hunterApiKey = process.env.HUNTER_API_KEY
    const enrichLayerApiKey = process.env.ENRICHLAYER_API_KEY

    if (!apolloApiKey) {
      return NextResponse.json(
        { error: 'Apollo API key not configured (APOLLO_API_KEY)' },
        { status: 500 }
      )
    }

    if (!claudeApiKey) {
      console.warn('⚠️  Claude API key not configured - will skip free website research')
    }
    if (!firecrawlApiKey) {
      console.warn('⚠️  Firecrawl API key not configured - Claude will fall back to basic scraping')
    }
    if (!betterEnrichApiKey) {
      console.warn('⚠️  BetterEnrich API key not configured - will fall back to Hunter/Apollo for email lookup')
    }
    if (!hunterApiKey) {
      console.warn('⚠️  Hunter API key not configured - will skip Hunter.io email finder')
    }
    if (!enrichLayerApiKey) {
      console.warn('⚠️  EnrichLayer API key not configured - will skip LinkedIn enrichment')
    }
    if (!apifyApiKey) {
      console.warn('⚠️  Apify API key not configured - will skip $0.005/lead enrichment tier')
    }

    console.log(`\n🚀 Starting enrichment queue processor...`)
    if (businessIds && businessIds.length > 0) {
      console.log(`   Mode: Selective (${businessIds.length} specific businesses)`)
    } else {
      console.log(`   Mode: Queue (max ${maxJobs} jobs)`)
    }
    console.log(`   Claude+Firecrawl: ${!!(claudeApiKey && firecrawlApiKey)}`)
    console.log(`   Web Search Agent: ${!!claudeApiKey}`)
    console.log(`   BetterEnrich: ${!!betterEnrichApiKey}`)
    console.log(`   Hunter.io: ${!!hunterApiKey}`)
    console.log(`   EnrichLayer: ${!!enrichLayerApiKey}`)
    console.log(`   Apify: ${!!apifyApiKey}`)
    console.log(`   Apollo (backup): ${!!apolloApiKey}`)

    // Initialize orchestrator
    const apolloMonthlyLimit = parseInt(process.env.APOLLO_MONTHLY_LIMIT || '100')
    const orchestrator = new ContactEnrichmentOrchestrator(
      apolloApiKey,
      apolloMonthlyLimit,
      claudeApiKey,
      apifyApiKey,
      firecrawlApiKey,
      betterEnrichApiKey,
      hunterApiKey,
      enrichLayerApiKey
    )

    // Process queue in background (non-blocking)
    const startTime = Date.now()
    const results: any[] = []

    try {
      // Get jobs from queue and process them
      let processedJobs = 0

      if (businessIds && businessIds.length > 0) {
        // Selective processing: process specific businesses
        for (const businessId of businessIds) {
          console.log(`\n📦 Processing selected business ${processedJobs + 1}/${businessIds.length}`)
          console.log(`   Business ID: ${businessId}`)

          // Enrich the business directly
          const result = await orchestrator.enrichBusiness(businessId)

          results.push({
            businessId: businessId,
            businessName: result.businessName || 'Unknown',
            success: result.success,
            contactsEnriched: result.contactsEnriched,
            method: result.method,
            apiCalls: result.totalApiCalls,
            cost: result.totalCostUsd,
            duration: result.durationMs,
            error: result.error,
          })

          processedJobs++
        }
      } else {
        // Queue processing: get next jobs from queue
        while (processedJobs < maxJobs) {
          const job = await orchestrator.getNextEnrichmentJob()

          if (!job) {
            console.log('✅ No more jobs in queue')
            break
          }

          console.log(`\n📦 Processing job ${processedJobs + 1}/${maxJobs}`)
          console.log(`   Queue ID: ${job.id}`)
          console.log(`   Business: ${job.business.name}`)

          // Update status to processing
          await orchestrator.updateQueueStatus(job.id, 'processing')

          // Enrich the business
          const result = await orchestrator.enrichBusiness(job.business_id)

          // Update queue with result
          await orchestrator.updateQueueStatus(
            job.id,
            result.success ? 'completed' : 'failed',
            result
          )

          results.push({
            queueId: job.id,
            businessId: job.business_id,
            businessName: job.business.name,
            success: result.success,
            contactsEnriched: result.contactsEnriched,
            method: result.method,
            apiCalls: result.totalApiCalls,
            cost: result.totalCostUsd,
            duration: result.durationMs,
            error: result.error,
          })

          processedJobs++
        }
      }

      const totalDuration = Date.now() - startTime
      const successCount = results.filter(r => r.success).length
      const failureCount = results.filter(r => !r.success).length
      const totalCost = results.reduce((sum, r) => sum + r.cost, 0)
      const totalContacts = results.reduce((sum, r) => sum + r.contactsEnriched, 0)

      console.log(`\n✅ Queue processing complete!`)
      console.log(`   Processed: ${processedJobs} jobs`)
      console.log(`   Success: ${successCount}`)
      console.log(`   Failed: ${failureCount}`)
      console.log(`   Contacts enriched: ${totalContacts}`)
      console.log(`   Total cost: $${totalCost.toFixed(4)}`)
      console.log(`   Total duration: ${totalDuration}ms`)

      await orchestrator.close()

      return NextResponse.json({
        success: true,
        summary: {
          jobsProcessed: processedJobs,
          successCount,
          failureCount,
          totalContacts,
          totalCost,
          totalDuration,
        },
        results,
      })
    } catch (processingError: any) {
      console.error('❌ Queue processing error:', processingError)
      await orchestrator.close()
      throw processingError
    }
  } catch (error: any) {
    console.error('[Process Queue] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process enrichment queue',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}
