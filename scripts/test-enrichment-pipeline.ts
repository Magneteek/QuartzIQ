/**
 * Test Enrichment Pipeline
 *
 * Runs the full enrichment pipeline against a real business without needing
 * a database record. Uses a hardcoded test business so we can validate each
 * tier independently.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/test-enrichment-pipeline.ts
 */

import * as dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '..', '.env.local') })

import { ClaudeWebsiteResearcher } from '../src/services/claude-website-researcher'
import { OwnerNameResearchAgent } from '../src/services/owner-name-research-agent'
import { BetterEnrichClient } from '../src/services/better-enrich-client'
import { HunterClient } from '../src/services/hunter-client'
import { ProxyCurlClient } from '../src/services/proxycurl-client'

// ─── Test Business ────────────────────────────────────────────────────────────
// Real Dutch dental/oral care practice — publicly listed, no DB record needed
const TEST_BUSINESS = {
  id: 'test-001',
  place_id: 'ChIJ_test_placeholder',
  name: 'Mondzorgcentrum',
  website: 'https://www.mondzorgcentrum.nl',
  phone: null,
  address: null,
  city: 'Netherlands',
  country_code: 'NL',
  rating: null,
  reviews_count: null,
}
// ─────────────────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

async function runTest() {
  console.log('\n' + '═'.repeat(60))
  console.log('  ENRICHMENT PIPELINE TEST')
  console.log('═'.repeat(60))
  console.log(`  Business : ${TEST_BUSINESS.name}`)
  console.log(`  Website  : ${TEST_BUSINESS.website}`)
  console.log(`  City     : ${TEST_BUSINESS.city}, ${TEST_BUSINESS.country_code}`)
  console.log('═'.repeat(60) + '\n')

  const claudeKey   = process.env.ANTHROPIC_API_KEY
  const firecrawlKey = process.env.FIRECRAWL_API_KEY
  const betterEnrichKey = process.env.BETTER_ENRICH_API_KEY
  const hunterKey   = process.env.HUNTER_API_KEY
  const proxyCurlKey = process.env.PROXYCURL_API_KEY

  console.log('🔑 API Keys:')
  console.log(`   Claude+Firecrawl : ${claudeKey && firecrawlKey ? '✅' : '⚠️  missing'}`)
  console.log(`   Web Search Agent : ${claudeKey ? '✅' : '⚠️  missing'}`)
  console.log(`   BetterEnrich     : ${betterEnrichKey ? '✅' : '⚠️  missing'}`)
  console.log(`   Hunter.io        : ${hunterKey ? '✅' : '⚠️  missing'}`)
  console.log(`   ProxyCurl        : ${proxyCurlKey ? '✅' : '⚠️  missing'}`)
  console.log('')

  const domain = extractDomain(TEST_BUSINESS.website)
  let totalCost = 0

  // ── Tier 1: Claude + Firecrawl website research ───────────────────────────
  console.log('─'.repeat(60))
  console.log('TIER 1 — Claude + Firecrawl Website Research (FREE)')
  console.log('─'.repeat(60))

  if (!claudeKey) {
    console.log('⚠️  Skipped — ANTHROPIC_API_KEY not set\n')
  } else {
    const claude = new ClaudeWebsiteResearcher(claudeKey, firecrawlKey)
    try {
      const result = await claude.researchWebsite(TEST_BUSINESS.website, TEST_BUSINESS.name, domain)
      console.log(`✅ Done in ${result.durationMs}ms`)
      console.log(`   Executives found : ${result.executives.length}`)
      console.log(`   Email patterns   : ${result.emailPatterns.length}`)
      console.log(`   Company emails   : ${result.companyEmails.length}`)

      if (result.executives.length > 0) {
        const ex = result.executives[0]
        console.log(`\n   Best executive:`)
        console.log(`     Name       : ${ex.fullName}`)
        console.log(`     Title      : ${ex.title || 'n/a'}`)
        console.log(`     Email      : ${ex.email || 'n/a'}`)
        console.log(`     Phone      : ${ex.phone || 'n/a'}`)
        console.log(`     LinkedIn   : ${ex.linkedinUrl || 'n/a'}`)
        console.log(`     Confidence : ${ex.confidence}`)
        console.log(`     Source     : ${ex.source}`)
      } else {
        console.log('   No executives found on website.')
      }

      if (result.companyEmails.length > 0) {
        console.log(`\n   Company emails: ${result.companyEmails.slice(0, 3).join(', ')}`)
      }
    } catch (err: any) {
      console.log(`❌ Error: ${err.message}`)
    }
    console.log('')
  }

  // ── Tier 2: Web Search Agent ──────────────────────────────────────────────
  console.log('─'.repeat(60))
  console.log('TIER 2 — Web Search Agent (owner name hunt)')
  console.log('─'.repeat(60))

  if (!claudeKey) {
    console.log('⚠️  Skipped — ANTHROPIC_API_KEY not set\n')
  } else {
    const agent = new OwnerNameResearchAgent(claudeKey)
    try {
      const result = await agent.findOwnerName(
        TEST_BUSINESS.name,
        domain,
        TEST_BUSINESS.city,
        TEST_BUSINESS.country_code
      )
      console.log(`✅ Done in ${result.durationMs}ms`)
      console.log(`   Found       : ${result.success}`)
      console.log(`   Name        : ${result.fullName || 'n/a'}`)
      console.log(`   Title       : ${result.title || 'n/a'}`)
      console.log(`   Phone       : ${result.phone || 'n/a'}`)
      console.log(`   LinkedIn    : ${result.linkedinUrl || 'n/a'}`)
      console.log(`   Confidence  : ${result.confidence}`)
      console.log(`   Sources     : ${result.sources?.join(', ') || 'none'}`)

      // If LinkedIn found, test ProxyCurl
      if (result.linkedinUrl && proxyCurlKey) {
        console.log(`\n   → LinkedIn URL found, testing ProxyCurl...`)
        const proxyCurl = new ProxyCurlClient(proxyCurlKey)
        const pcResult = await proxyCurl.enrichFromLinkedIn(result.linkedinUrl)
        totalCost += pcResult.costUsd
        console.log(`   ProxyCurl email : ${pcResult.email || 'n/a'}`)
        console.log(`   ProxyCurl phone : ${pcResult.phone || 'n/a'}`)
        console.log(`   Credits used    : ${pcResult.creditsUsed}`)
        console.log(`   Cost            : $${pcResult.costUsd.toFixed(4)}`)
      }
    } catch (err: any) {
      console.log(`❌ Error: ${err.message}`)
    }
    console.log('')
  }

  // ── Tier 3: BetterEnrich ──────────────────────────────────────────────────
  console.log('─'.repeat(60))
  console.log('TIER 3 — BetterEnrich (pay-per-success, ~$0.031)')
  console.log('─'.repeat(60))

  if (!betterEnrichKey) {
    console.log('⚠️  Skipped — BETTER_ENRICH_API_KEY not set\n')
  } else {
    const betterEnrich = new BetterEnrichClient(betterEnrichKey)
    // Test with a plausible owner name — in real pipeline this comes from Tier 1/2
    const testName = 'Jan de Vries'
    console.log(`   Testing with name: "${testName}" @ ${domain}`)
    try {
      const result = await betterEnrich.findWorkEmail(testName, domain)
      totalCost += result.costUsd
      console.log(`✅ Done`)
      console.log(`   Found : ${result.success}`)
      console.log(`   Email : ${result.email || 'n/a'}`)
      console.log(`   Cost  : $${result.costUsd.toFixed(4)}`)
    } catch (err: any) {
      console.log(`❌ Error: ${err.message}`)
    }
    console.log('')
  }

  // ── Tier 4: Hunter.io ─────────────────────────────────────────────────────
  console.log('─'.repeat(60))
  console.log('TIER 4 — Hunter.io (pay-per-success, ~$0.01)')
  console.log('─'.repeat(60))

  if (!hunterKey) {
    console.log('⚠️  Skipped — HUNTER_API_KEY not set\n')
  } else {
    const hunter = new HunterClient(hunterKey)
    // Test with a plausible name — in real pipeline this comes from Tier 1/2
    const firstName = 'Jan'
    const lastName = 'de Vries'
    console.log(`   Testing with name: "${firstName} ${lastName}" @ ${domain}`)
    try {
      const result = await hunter.findEmail(firstName, lastName, domain)
      totalCost += result.costUsd
      console.log(`✅ Done`)
      console.log(`   Found    : ${result.success}`)
      console.log(`   Email    : ${result.email || 'n/a'}`)
      console.log(`   Score    : ${result.score}`)
      console.log(`   LinkedIn : ${result.linkedinUrl || 'n/a'}`)
      console.log(`   Cost     : $${result.costUsd.toFixed(4)}`)
    } catch (err: any) {
      console.log(`❌ Error: ${err.message}`)
    }
    console.log('')
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('═'.repeat(60))
  console.log(`  TOTAL COST THIS RUN: $${totalCost.toFixed(4)}`)
  console.log('═'.repeat(60) + '\n')
}

runTest().catch(console.error)
