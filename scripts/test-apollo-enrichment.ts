import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

async function testApolloEnrichment(maxBusinesses: number = 3) {
  console.log('\n🧪 Testing Apollo Enrichment...\n')

  try {
    // Check API keys
    console.log('🔑 Checking API keys...')
    const apolloKey = process.env.APOLLO_API_KEY
    const claudeKey = process.env.ANTHROPIC_API_KEY
    const apifyKey = process.env.APIFY_API_TOKEN

    console.log(\`   Apollo API Key: \${apolloKey ? '✅ Set' : '❌ Missing'}\`)
    console.log(\`   Claude API Key: \${claudeKey ? '✅ Set' : '⚠️  Missing (optional)'}\`)
    console.log(\`   Apify API Key: \${apifyKey ? '✅ Set' : '⚠️  Missing (optional)'}\`)
    console.log('')

    if (!apolloKey) {
      console.error('❌ Apollo API key required! Add APOLLO_API_KEY to .env.local')
      process.exit(1)
    }

    // Get businesses ready for enrichment
    console.log('📋 Finding businesses ready for enrichment...')

    const businessQuery = \`
      SELECT id, name, website, category, rating, reviews_count, city, country_code
      FROM businesses
      WHERE ready_for_enrichment = true
        AND lifecycle_stage IN ('lead', 'qualified')
        AND (enrichment_status IS NULL OR enrichment_status = 'pending')
      ORDER BY enrichment_priority DESC NULLS LAST
      LIMIT \$1
    \`

    const businessesResult = await pool.query(businessQuery, [maxBusinesses])
    const businesses = businessesResult.rows

    if (businesses.length === 0) {
      console.log('⚠️  No businesses ready for enrichment')
      process.exit(0)
    }

    console.log(\`   Found \${businesses.length} businesses:\\n\`)
    businesses.forEach((b: any, i: number) => {
      console.log(\`   \${i + 1}. \${b.name}\`)
      console.log(\`      Website: \${b.website || 'N/A'}\`)
      console.log(\`      Category: \${b.category || 'N/A'}\\n\`)
    })

    console.log('\\n✅ Setup complete!')
    console.log('\\n📝 To run enrichment, go to:')
    console.log('   http://localhost:3069/dashboard/enrichment')
    console.log('\\n   Or use the API endpoint from your app')

  } catch (error) {
    console.error('❌ Test failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

const maxBusinesses = process.argv[2] ? parseInt(process.argv[2]) : 3
testApolloEnrichment(maxBusinesses)
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
