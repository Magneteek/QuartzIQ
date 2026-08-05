---
name: Enrichment Pipeline Design
description: Current contact enrichment pipeline steps, disabled services and reasons, cost per contact
type: project
---

Current enrichment pipeline (as of 2026-04-18):

1. **Firecrawl + Claude** — website scrape for emails, phone, owner name (FREE)
2. **Web Search Agent** — owner name + LinkedIn via Claude web search (~$0.02)
   - LinkedIn found? → **EnrichLayer** email + phone (~$0.017–0.06/profile)
3. **BetterEnrich** — email lookup by domain (~$0.031, pay-per-success)
4. **Hunter.io** — email finder fallback (~$0.01, pay-per-success)
5. **GMB phone** — always available from Google Maps scrape as fallback

**Disabled:**
- Apollo: `apolloDisabled = true` in orchestrator. <10% hit rate for small local businesses, $0.10/call regardless of outcome.
- Apify contact enrichment: `apifyEnrichmentDisabled = true`. Low hit rate for small businesses with thin GBP profiles.

**Apify IS still used** for business discovery and review scraping. Only the contact enrichment step is disabled.

**Why Apollo is off:** Target segment is small independent local businesses (dentists, etc.). These have low LinkedIn/Apollo B2B database coverage. BetterEnrich + Hunter is more cost-effective.

**Storage:** Results go to `contact_enrichments` table, NOT the `businesses` columns. The businesses table columns (`owner_first_name`, `email_enriched` etc.) are legacy/unused. Always query `contact_enrichments` for enrichment data.

**Trigger:** `POST /api/cron/enrichment` with Bearer token (CRON_SECRET). Also triggered manually from `/dashboard/enrichment`.

**Cost benchmark (Canary Islands dentists run):** ~75 contacts enriched, avg ~$0.06/contact total across all tiers.
