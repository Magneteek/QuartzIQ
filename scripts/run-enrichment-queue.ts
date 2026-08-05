/**
 * Run Enrichment Queue — Standalone
 * Processes the enrichment_queue directly without needing the dev server.
 *
 * Usage:
 *   npx tsx scripts/run-enrichment-queue.ts
 *   npx tsx scripts/run-enrichment-queue.ts --batch 50
 *   npx tsx scripts/run-enrichment-queue.ts --dry-run
 *
 * (ts-node no longer works here as of Node 22 — its require() resolution
 * can't resolve extension-less imports into src/. tsx fixes this.)
 */

import * as dotenv from 'dotenv'
import { join } from 'path'
dotenv.config({ path: join(__dirname, '..', '.env.local') })

import { ContactEnrichmentOrchestrator } from '../src/services/contact-enrichment-orchestrator'

const args = process.argv.slice(2)
function getArg(flag: string) {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : null
}
const batchSize = parseInt(getArg('--batch') || '511')
const isDryRun = args.includes('--dry-run')

async function main() {
  const orchestrator = new ContactEnrichmentOrchestrator(
    process.env.APOLLO_API_KEY!,
    parseInt(process.env.APOLLO_MONTHLY_LIMIT || '100'),
    process.env.ANTHROPIC_API_KEY,
    process.env.APIFY_API_TOKEN,
    process.env.FIRECRAWL_API_KEY,
    process.env.BETTER_ENRICH_API_KEY,
    process.env.HUNTER_API_KEY,
    process.env.ENRICHLAYER_API_KEY,
  )

  console.log('\n🚀 QuartzIQ Enrichment Queue Runner')
  console.log('═'.repeat(50))
  console.log(`Batch size: ${batchSize}`)
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('═'.repeat(50))

  let processed = 0
  let succeeded = 0
  let failed = 0
  let totalCost = 0
  const startTime = Date.now()

  while (processed < batchSize) {
    const job = await orchestrator.getNextEnrichmentJob()
    if (!job) {
      console.log('\n✅ Queue empty — all jobs processed.')
      break
    }

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    console.log(`\n[${processed + 1}/${batchSize}] ${job.business.name} (${job.business.city || '?'}) — ${elapsed}min elapsed`)

    if (isDryRun) {
      console.log(`  🔍 DRY RUN — would enrich: ${job.business.website || 'no website'}`)
      processed++
      continue
    }

    await orchestrator.updateQueueStatus(job.id, 'processing')

    try {
      const result = await orchestrator.enrichBusiness(job.business_id)
      try {
        await orchestrator.updateQueueStatus(job.id, result.success ? 'completed' : 'failed', result)
      } catch (dbErr: any) {
        // Ignore duplicate key errors from prior failed/completed rows for same business
        if (!dbErr.code || dbErr.code !== '23505') throw dbErr
      }

      if (result.success) {
        succeeded++
        totalCost += result.totalCostUsd
        console.log(`  ✅ ${result.method} | cost: $${result.totalCostUsd.toFixed(4)}`)
      } else {
        failed++
        console.log(`  ❌ Failed: ${result.error}`)
      }
    } catch (err: any) {
      failed++
      try {
        await orchestrator.updateQueueStatus(job.id, 'failed', { error: err.message } as any)
      } catch (_) {}
      console.log(`  ❌ Exception: ${err.message}`)
    }

    processed++

    // Progress summary every 50 leads
    if (processed % 50 === 0) {
      const mins = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
      console.log(`\n📊 Progress: ${processed} processed | ${succeeded} ok | ${failed} failed | $${totalCost.toFixed(2)} spent | ${mins}min`)
    }
  }

  await orchestrator.close()

  const totalMins = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  console.log('\n' + '═'.repeat(50))
  console.log('📊 ENRICHMENT COMPLETE')
  console.log('═'.repeat(50))
  console.log(`  Processed:  ${processed}`)
  console.log(`  Succeeded:  ${succeeded}`)
  console.log(`  Failed:     ${failed}`)
  console.log(`  Total cost: $${totalCost.toFixed(2)}`)
  console.log(`  Duration:   ${totalMins} min`)
}

main().catch(err => { console.error(err); process.exit(1) })
