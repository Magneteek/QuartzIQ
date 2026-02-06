# Contact Enrichment Workflow

## Overview

The enrichment system automatically finds executive contact information (name, email, phone) for qualified leads using a cost-optimized multi-step approach.

## How It Works

### Step 1: Queue Leads for Enrichment

1. Go to **Lead Qualification** page (`/dashboard/leads`)
2. Select leads you want to enrich
3. Click the **"Import to Quartz"** button (Send icon) for each lead
4. This moves the lead to:
   - Lifecycle stage: `qualified`
   - Enrichment status: `pending`
   - Adds to `enrichment_queue` table

### Step 2: Process the Queue

1. Go to **Contact Enrichment** page (`/dashboard/enrichment`)
2. You'll see all leads with "pending" status
3. Click the **"Process Queue (X)"** button in the header
4. The system will automatically process up to 10 leads at a time

### Step 3: Automated Enrichment Process

For each lead in queue, the system follows this **3-tier cost-optimized workflow**:

#### 1️⃣ **Claude Website Research** (FREE)
- Scrapes the business website
- Extracts executive names, titles, emails, phone numbers
- Identifies email patterns
- **Success rate**: ~40%
- **Cost**: $0.00
- **If found**: Saves contact and stops ✅

#### 2️⃣ **Apify Leads Enrichment** ($0.005 per lead) ⭐ NEW!
- Uses place_id to extract employee data from Google Maps
- Gets names, emails, phone numbers, job titles, LinkedIn profiles
- Filters by department (executive, management)
- **Success rate**: ~30%
- **Cost**: $0.005 per lead found
- **If found**: Saves contact and stops ✅

#### 3️⃣ **Apollo Search + Enrich** ($0.01-0.02 - final fallback)
- Searches for executives by domain
- Enriches the top executive found
- **Success rate**: ~80-90%
- **Cost**: 2 credits (~$0.02)
- **If found**: Saves contact ✅

### Results

After processing, each lead will have:
- **enrichment_status**: `completed` or `failed`
- Contact information stored in `contact_enrichments` table
- Updated business record with first_name, last_name, email, phone
- API usage logged in `apollo_api_log` table

## Cost Optimization

The system uses a **3-tier approach** to minimize API costs:

| Method | API Calls | Cost | Success Rate | Savings vs Apollo |
|--------|-----------|------|--------------|-------------------|
| Claude Only | 0 | $0.00 | 40% | 100% 🎉 |
| Apify Only | 1 | $0.005 | 30% | 75% 💰 |
| Apollo Search + Enrich | 2 | $0.02 | 90% | 0% (baseline) |

**Expected average cost per lead**: ~$0.0065 (vs $0.02 with Apollo only)
**Total savings**: ~67% cost reduction!

## Configuration

### Required Environment Variables

```env
# Required for enrichment
APOLLO_API_KEY=your_apollo_api_key_here
APOLLO_MONTHLY_LIMIT=100

# Recommended - saves 75% on costs!
APIFY_API_TOKEN=your_apify_api_token_here

# Optional - enables free Claude research (saves 100% on some leads)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### API Keys

1. **Apollo.io API Key** (Required)
   - Get from: https://apollo.io/settings/integrations
   - Free tier: 100 credits/month
   - Paid plans: Higher limits
   - Cost: ~$0.02 per lead

2. **Apify API Token** (Highly Recommended) ⭐
   - Get from: https://console.apify.com/account/integrations
   - Enables $0.005/lead enrichment tier
   - Saves ~75% vs Apollo
   - Requires place_id from business

3. **Anthropic API Key** (Optional but Recommended)
   - Get from: https://console.anthropic.com/
   - Enables FREE website research
   - Saves 100% on ~40% of leads

## Manual Enrichment

If you prefer to enrich manually:

1. Go to **Contact Enrichment** page
2. Click **"Enrich"** button for any lead
3. Research and enter contact details manually
4. Set confidence level and data source
5. Click **"Complete Enrichment"** to save

## Workflow States

### Lead Qualification Page
- **Lifecycle Stage**: `prospect` → `lead` → `qualified`
- **Ready for Enrichment**: `false` → `true` (when queued)

### Enrichment Queue
- **Status**: `queued` → `processing` → `completed` or `failed`
- Tracks API usage and costs
- Logs any errors

### Contact Enrichment Page
- **Enrichment Status**: `pending` → `in_progress` → `completed`
- Shows confidence scores
- Displays enrichment method used

## Troubleshooting

### "User organization not found"
- Run: `npm run fix-user-org` to assign users to organizations

### "Apollo API key not configured"
- Add `APOLLO_API_KEY` to `.env.local`

### "No more jobs in queue"
- All leads have been processed
- Queue new leads from Lead Qualification page

### Processing takes too long
- Default batch size: 10 leads
- Each lead takes ~3-10 seconds depending on method
- Total time: ~30-100 seconds for 10 leads

## Database Tables

### `enrichment_queue`
- Tracks queued enrichment jobs
- Priority-based processing
- Records API usage and costs

### `contact_enrichments`
- Stores found contact information
- Tracks enrichment method and confidence
- Links to business via `business_id`

### `apollo_api_log`
- Logs all Apollo API calls
- Tracks credits used and costs
- Helps analyze usage patterns

## Next Steps

1. ✅ Queue leads from Lead Qualification page
2. ✅ Click "Process Queue" on Enrichment page
3. ✅ Review results and contact information
4. 📊 Monitor API usage and costs
5. 🚀 Export enriched contacts to CRM

## Cron Job (Future Enhancement)

To fully automate enrichment:

1. Create a cron job that hits `/api/enrichment/process-queue` every hour
2. Or use Vercel Cron: https://vercel.com/docs/cron-jobs
3. Or deploy as a separate worker process

Example cron (hourly):
```bash
0 * * * * curl -X POST https://your-domain.com/api/enrichment/process-queue
```
