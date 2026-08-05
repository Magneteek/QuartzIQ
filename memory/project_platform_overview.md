---
name: QuartzIQ Platform Overview
description: What the app is, who uses it, the full lead-to-customer lifecycle, and GHL integration dynamics
type: project
---

QuartzIQ is a B2B lead generation + customer monitoring platform for agencies selling reputation/marketing services to local businesses (primary target: dentists in Spain/Canary Islands selling VinciSmile aligners + digital marketing).

**Why:** The agency needs a pipeline to discover leads, enrich contact data, qualify them, push to GHL for outreach, and then monitor clients' Google reviews once they convert.

**How to apply:** Every feature decision flows from this core loop: Discover → Score → Enrich → Push to GHL → Monitor.

---

## Full Lead Lifecycle

1. **Discover** — Batch scrape via Apify (`compass~crawler-google-places`) with Nominatim geocoding. City-by-city with bbox-based search. Script: `scripts/batch-spain-dentists.js`

2. **Score (0–100)** — Auto-scored from Google Maps signals: rating (0–30), review count (0–25), website+phone presence (0–25), profile investment (0–20). Stored in `businesses.lead_score`.

3. **Enrich** — Multi-tier pipeline writes to `contact_enrichments` table (NOT businesses columns):
   - Firecrawl + Claude website scrape (free)
   - Web Search Agent → owner name + LinkedIn (~$0.02)
   - EnrichLayer if LinkedIn found (~$0.017–0.06)
   - BetterEnrich email lookup (~$0.031)
   - Hunter.io email fallback (~$0.01)
   - Apollo disabled (too expensive, low hit rate for small local businesses)

4. **Push to GHL** — `POST /api/quartz-leads/send-contacts` → `GHL_WEBHOOK_URL`. GHL workflow creates contact + opportunity.

5. **Convert** — When deal closes, contact gets tagged "customer" in GHL → fires webhook to QuartzIQ → monitoring enabled.

6. **Monitor** — Cron checks Google reviews every 14 days. Negative reviews (≤3 stars) → alert in DB + fires `GHL_WEBHOOK_URL` → GHL emails client.

---

## GHL (Quartz) Integration — 3 Data Flows

### Flow 1: GHL → QuartzIQ (Customer Tag)
- Trigger: contact tagged "customer" in GHL automation
- Endpoint: `POST /api/webhooks/ghl/customer-tagged`
- Effect: sets `is_paying_customer=true`, `monitoring_enabled=true`, `monitoring_frequency_hours=336`
- Matches by: place_id → email → company_name

### Flow 2: QuartzIQ → GHL (Lead Push)
- Used to send qualified + enriched leads into GHL for outreach
- `POST /api/quartz-leads/send-contacts` → `GHL_WEBHOOK_URL`
- GHL workflow: creates contact, creates opportunity, sends notification

### Flow 3: QuartzIQ → GHL (Review Alert)
- Triggered when monitoring cron detects negative review
- Posts to `GHL_WEBHOOK_URL`
- GHL workflow: emails client, creates opportunity to follow up

### TODO: Flow 4 — Reverse Customer Sync
When a lead is marked customer directly in QuartzIQ (not via GHL), the GHL contact should be created/tagged via GHL Contacts API. Not yet implemented.

---

## Monitoring Dynamics

- Cron: every 14 days at 2am (`0 2 */14 * * curl ... /api/cron/monitoring`)
- Only runs for `is_paying_customer=true AND monitoring_enabled=true`
- Alert threshold: ≤3 stars (configurable per customer)
- Alerts stored in `customer_monitoring_alerts`
- Dashboard: `/dashboard/monitoring` shows unacknowledged alerts
- Customer list: `/dashboard/customers` shows all paying customers + monitoring status

---

## Deployment

- Production: `https://iq.quartzleads.com`
- Server: Digital Ocean droplet, `/var/www/quartziq`, PM2
- GHL location ID: `8opNHzwsADYRdyueAita`
- GitHub: `github.com/Magneteek/QuartzIQ`
