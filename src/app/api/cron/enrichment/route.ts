/**
 * Cron Job: Automated Contact Enrichment
 * GET/POST /api/cron/enrichment
 *
 * Schedule: Hourly (0 * * * *) or as needed
 *
 * Processes the enrichment queue automatically without manual intervention.
 * Uses Firecrawl + Claude (Tier 1, free) before paid APIs.
 *
 * Railway cron config example:
 * Schedule: 0 * * * *
 * Command: curl -X POST https://your-domain.com/api/cron/enrichment \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server'
import { ContactEnrichmentOrchestrator } from '@/services/contact-enrichment-orchestrator'

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('❌ CRON_SECRET not configured')
    return NextResponse.json(
      { success: false, error: 'Cron secret not configured' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ Unauthorized enrichment cron request')
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const apolloApiKey = process.env.APOLLO_API_KEY
  if (!apolloApiKey) {
    return NextResponse.json(
      { success: false, error: 'APOLLO_API_KEY not configured' },
      { status: 500 }
    )
  }

  const claudeApiKey = process.env.ANTHROPIC_API_KEY
  const apifyApiKey = process.env.APIFY_API_TOKEN
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
  const betterEnrichApiKey = process.env.BETTER_ENRICH_API_KEY
  const apolloMonthlyLimit = parseInt(process.env.APOLLO_MONTHLY_LIMIT || '100')

  console.log('🔄 [CRON] Starting automated enrichment cycle...')
  console.log(`📅 [CRON] Timestamp: ${new Date().toISOString()}`)
  console.log(`   Claude+Firecrawl: ${!!(claudeApiKey && firecrawlApiKey)}`)
  console.log(`   BetterEnrich: ${!!betterEnrichApiKey}`)
  console.log(`   Apify: ${!!apifyApiKey}`)
  console.log(`   Apollo (backup): ${!!apolloApiKey}`)

  const orchestrator = new ContactEnrichmentOrchestrator(
    apolloApiKey,
    apolloMonthlyLimit,
    claudeApiKey,
    apifyApiKey,
    firecrawlApiKey,
    betterEnrichApiKey
  )

  try {
    const maxJobs = 20
    const results: Array<{
      queueId: string
      businessId: string
      businessName: string
      success: boolean
      contactsEnriched: number
      method: string
      cost: number
      error?: string
    }> = []

    let processedJobs = 0

    while (processedJobs < maxJobs) {
      const job = await orchestrator.getNextEnrichmentJob()

      if (!job) {
        console.log('✅ [CRON] No more jobs in queue')
        break
      }

      console.log(`\n📦 [CRON] Processing job ${processedJobs + 1}/${maxJobs}: ${job.business.name}`)

      await orchestrator.updateQueueStatus(job.id, 'processing')

      const result = await orchestrator.enrichBusiness(job.business_id)

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
        cost: result.totalCostUsd,
        error: result.error,
      })

      processedJobs++
    }

    await orchestrator.close()

    const duration = Date.now() - startTime
    const successCount = results.filter((r) => r.success).length
    const failedCount = results.filter((r) => !r.success).length
    const totalContacts = results.reduce((sum, r) => sum + r.contactsEnriched, 0)
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0)

    const summary = {
      jobsProcessed: processedJobs,
      success: successCount,
      failed: failedCount,
      contactsEnriched: totalContacts,
      totalCostUsd: Number(totalCost.toFixed(4)),
      durationMs: duration,
      durationSeconds: (duration / 1000).toFixed(1),
    }

    console.log('✅ [CRON] Enrichment cycle complete:', summary)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      results: results.map((r) => ({
        businessName: r.businessName,
        success: r.success,
        contactsEnriched: r.contactsEnriched,
        method: r.method,
        cost: r.cost,
        error: r.error,
      })),
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('❌ [CRON] Enrichment cycle failed:', error)
    await orchestrator.close().catch(() => {})

    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: duration,
      },
      { status: 500 }
    )
  }
}

// Support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}
