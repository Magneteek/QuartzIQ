# QuartzIQ — Project Memory

## CRITICAL CONFIGURATION

### PORT — MANDATORY
**Dev server MUST run on port 3069**
```bash
PORT=3069 npm run dev
```

### Deployment
- **Production URL:** `https://iq.quartzleads.com`
- **Server:** Digital Ocean droplet (Docker Ubuntu, Amsterdam)
- **Path:** `/var/www/quartziq`
- **Process manager:** PM2 (`pm2 restart all`)
- **Repo:** `github.com/Magneteek/QuartzIQ`

---

## WHAT THIS APP IS

QuartzIQ is a **B2B lead generation + customer monitoring platform** for agencies selling reputation/marketing services (e.g. VinciSmile aligners + digital marketing) to local businesses (dentists, restaurants, hotels etc.).

### Core workflow:
1. **Discover** — scrape businesses from Google Maps via Apify (city-by-city, bbox-based)
2. **Score** — auto-score leads 0–100 based on Google profile signals
3. **Enrich** — find owner name, email, phone via multi-tier enrichment pipeline
4. **Send to GHL** — push qualified leads to Quartz (GoHighLevel CRM) for outreach
5. **Monitor** — once a lead converts to customer, monitor their Google reviews for negatives and alert them

---

## TECH STACK

- Next.js 15 App Router, TypeScript
- PostgreSQL on Supabase (`businesses` table is the core entity)
- ShadCN UI + Tailwind CSS
- Apify (`compass~crawler-google-places`) for Google Maps scraping
- Firecrawl + Claude for website scraping/enrichment
- GoHighLevel (GHL) as the CRM (branded as "Quartz")

---

## DATABASE — KEY TABLES

| Table | Purpose |
|---|---|
| `businesses` | Core lead/customer records (scraped from Google Maps) |
| `reviews` | Google reviews for monitored customers |
| `customer_monitoring_alerts` | Negative review alerts for customers |
| `contact_enrichments` | Enrichment results (NOT stored on businesses columns) |
| `enrichment_queue` | Queue for enrichment jobs |
| `search_sessions` | History of Apify scrape sessions |
| `monitoring_configs` | Per-customer monitoring settings |

**Important:** Enrichment data (owner name, enriched email etc.) lives in `contact_enrichments`, not on the `businesses` row directly.

---

## LEAD SCORING (0–100)

Computed from Google Maps data:
- Rating (0–30 pts)
- Review count (0–25 pts)
- Has website + phone (0–25 pts)
- Profile investment signals (0–20 pts)

Stored in `businesses.lead_score`. Color-coded in UI: green ≥70, yellow ≥50, grey <50.

---

## ENRICHMENT PIPELINE

Order of execution per lead:
1. **Firecrawl + Claude** — scrape business website for contact info (FREE)
2. **Web Search Agent** — find owner name + LinkedIn (~$0.02)
   - If LinkedIn found → **EnrichLayer** for email/phone (~$0.017–0.06)
3. **BetterEnrich** — email lookup by domain (~$0.031, pay-per-success)
4. **Hunter.io** — email finder fallback (~$0.01, pay-per-success)
5. **Apollo** — disabled by default (`apolloDisabled = true`), <10% hit rate for small local businesses

Results stored in `contact_enrichments` table.
Triggered via `POST /api/cron/enrichment` (Bearer token = `CRON_SECRET`).

---

## GHL (QUARTZ) INTEGRATION

### Overview
GHL is the CRM (branded "Quartz"). QuartzIQ connects to it in 3 ways:

### 1. GHL → QuartzIQ: Customer Tagging Webhook
**Trigger:** Contact tagged "customer" in GHL
**Endpoint:** `POST /api/webhooks/ghl/customer-tagged`
**Header:** `x-webhook-secret: {GHL_WEBHOOK_SECRET}`
**Effect:** Finds or creates business record, sets `is_paying_customer=true`, `monitoring_enabled=true`, `monitoring_frequency_hours=336` (14 days)

**Matching priority:** place_id → email → company_name (case-insensitive)
**Also syncs:** name, first_name, last_name, phone, website, category, ghl_contact_id, google_maps_url

GHL webhook body must send:
```json
{
  "contactId": "{{contact.id}}",
  "firstName": "{{contact.first_name}}",
  "lastName": "{{contact.last_name}}",
  "companyName": "{{contact.company_name}}",
  "email": "{{contact.email}}",
  "phone": "{{contact.phone}}",
  "website": "{{contact.website}}",
  "placeId": "{{contact.place_id}}",
  "googleMapsUrl": "{{contact.google_url}}",
  "category": "{{contact.niche__category}}"
}
```

### 2. QuartzIQ → GHL: Lead/Enriched Contact Push
**Endpoint:** `POST /api/quartz-leads/send-contacts`
**Target:** GHL inbound webhook `GHL_WEBHOOK_URL`
**Used for:** Sending qualified + enriched leads from QuartzIQ into GHL for outreach
**Flow:** Lead discovered → scored → enriched → pushed to GHL → GHL creates contact, opportunity, sends notification

### 3. QuartzIQ → GHL: Negative Review Alerts
**Target:** Same `GHL_WEBHOOK_URL`
**Triggered by:** Monitoring cron detecting new ≤3 star reviews
**Effect:** GHL workflow creates opportunity + emails client with alert

### GHL Custom Fields (Quartz side)
| Field | GHL variable |
|---|---|
| Place ID | `{{contact.place_id}}` |
| Google profile URL | `{{contact.google_url}}` |
| Website | `{{contact.website}}` |
| Niche/Category | `{{contact.niche__category}}` |
| Review Stars | `{{contact.review_stars}}` |
| Qualified Reviews Content | `{{contact.qualified_reviews_content}}` |
| Google Qualified Reviews | `{{contact.google_qualified_reviews}}` |

---

## MONITORING SYSTEM

### How it works
- Only runs for businesses where `is_paying_customer=true AND monitoring_enabled=true`
- Checks Google reviews via Apify, compares against known reviews in `reviews` table
- New reviews with rating ≤ `monitoring_alert_threshold` (default: 3 stars) → create alert in `customer_monitoring_alerts`
- Alerts shown in `/dashboard/monitoring` page
- Alert also fired to GHL via `GHL_WEBHOOK_URL` → client gets email notification

### Cron schedule
```
0 2 */14 * * curl -s -X POST http://localhost:3069/api/cron/monitoring \
  -H "Authorization: Bearer {CRON_SECRET}" >> /var/log/quartziq-monitoring.log 2>&1
```
Runs every 14 days at 2am. Frequency matches `monitoring_frequency_hours=336`.

### Manual trigger
```bash
curl -s -X POST http://localhost:3069/api/cron/monitoring \
  -H "Authorization: Bearer aS3FNQX3GSuIuVoNPl4AWpPdzriBoHokcveTOkkg5b4="
```

### Reverse sync (TODO)
When a lead is marked as customer directly in QuartzIQ (not via GHL tag), the GHL contact should be found/created and tagged "customer" via GHL Contacts API. Not yet implemented.

---

## BATCH SCRAPING

```bash
# All cities
node scripts/batch-spain-dentists.js

# Top 20 cities only
node scripts/batch-spain-dentists.js --top20

# Dry run (no Apify calls)
node scripts/batch-spain-dentists.js --dry-run

# Resume from city index N
node scripts/batch-spain-dentists.js --resume 30
```

Uses Nominatim for geocoding (rate limit: 1 req/sec — 1.1s delay built in).
Apify bbox-based search, 200 results per city.
Nominatim `boundingbox` used for island-level searches (Canary Islands).

---

## KEY ENV VARS

```
POSTGRES_HOST / PORT / DATABASE / USER / PASSWORD  — Supabase connection
DATABASE_URL                    — Full connection URI
APIFY_API_TOKEN                 — Google Maps scraping
FIRECRAWL_API_KEY               — Website scraping
ANTHROPIC_API_KEY               — Claude for website analysis
BETTER_ENRICH_API_KEY           — Primary email enrichment
HUNTER_API_KEY                  — Email finder fallback
ENRICHLAYER_API_KEY             — LinkedIn enrichment
APOLLO_API_KEY                  — Backup enrichment (disabled)
GHL_API_KEY                     — GHL REST API
GHL_LOCATION_ID                 — 8opNHzwsADYRdyueAita
GHL_WEBHOOK_URL                 — GHL inbound webhook (for sending alerts + leads TO GHL)
GHL_WEBHOOK_SECRET              — Auth header for inbound webhook FROM GHL
CRON_SECRET                     — Bearer token for /api/cron/* endpoints
NEXTAUTH_SECRET / NEXTAUTH_URL  — Auth
```

---

## DASHBOARD PAGES

| Route | Purpose |
|---|---|
| `/dashboard/leads` | All businesses, filterable, lead scoring, mark as customer |
| `/dashboard/customers` | Paying customers with monitoring status |
| `/dashboard/monitoring` | Negative review alerts |
| `/dashboard/enrichment` | Enrichment queue and results |
| `/dashboard/crawl-manager` | Manual Apify scrape trigger |
| `/dashboard/search-history` | Past scrape sessions |

---

## DEVELOPMENT NOTES

- Linting disabled during builds (`ignoreDuringBuilds: true` in next.config.ts) — too many warnings, not breaking
- TypeScript strict mode — type errors WILL fail builds
- `contact_enrichments` table is the source of truth for enriched contact data, never the `businesses` columns
- `place_id` is the primary dedup key for businesses
- `businesses.fingerprint` has a unique constraint — batch scripts need per-item try/catch
