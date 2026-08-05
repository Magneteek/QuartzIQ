/**
 * Roast Pipeline — Stage 1 Qualifier Runner
 * Read-only report: no website / unclaimed GMB / has-website-unaudited counts and samples.
 *
 * Usage:
 *   npm run roast:qualify
 *   npm run roast:qualify -- --limit 20
 */

import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '..', '.env.local') })

import { RoastQualifier } from '../src/services/roast-qualifier'

const args = process.argv.slice(2)
function getArg(flag: string) {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : null
}
const limit = parseInt(getArg('--limit') || '20')

async function main() {
  const qualifier = new RoastQualifier()

  console.log('\n🔥 Roast Pipeline — Stage 1 Qualifier')
  console.log('═'.repeat(50))

  const summary = await qualifier.getSummaryCounts()
  console.log(`No website:               ${summary.noWebsite}`)
  console.log(`Unclaimed GMB:            ${summary.unclaimed}`)
  console.log(`is_claimed not yet known: ${summary.unclaimedUnknown}  ← needs a backfill pass, see note below`)
  console.log(`Has website (stage 3):    ${summary.hasWebsiteUnaudited}`)
  console.log('═'.repeat(50))

  if (summary.unclaimed === 0 && summary.unclaimedUnknown > 0) {
    console.log('\n⚠️  is_claimed is unpopulated for existing rows — that column was just')
    console.log('    added and nothing has backfilled it from business_data_search yet.')
    console.log('    The "unclaimed" bucket will stay empty until that runs.')
  }

  const noWebsite = await qualifier.getNoWebsite(limit)
  console.log(`\n📋 No website (top ${noWebsite.length}):`)
  noWebsite.forEach(b => console.log(`  - ${b.name} (${b.city || '?'}) — ${b.reviews_count || 0} reviews`))

  const unclaimed = await qualifier.getUnclaimed(limit)
  console.log(`\n📋 Unclaimed (top ${unclaimed.length}):`)
  unclaimed.forEach(b => console.log(`  - ${b.name} (${b.city || '?'}) — ${b.reviews_count || 0} reviews`))

  await qualifier.close()
}

main().catch(err => { console.error(err); process.exit(1) })
