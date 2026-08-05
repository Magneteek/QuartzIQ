---
name: Apify Enrichment Research
description: Research into Apify contact enrichment actors — concluded none add value over current stack
type: project
---

Researched 2026-03-28. Conclusion: no Apify enrichment actor is worth integrating.

**What was evaluated:**
- `vdrmota/contact-info-scraper` — website crawl + email/phone + leads add-on. Duplicates Firecrawl+Claude + ProxyCurl.
- `dominic-quaiser/decision-maker-name-email-extractor` — NER name+email from team pages. Duplicates Claude website researcher. $15/mo fixed cost.
- `snipercoder/decision-maker-email-finder` — domain → decision maker email. Duplicates BetterEnrich + Hunter.
- Apollo bridge, LinkedIn scrapers, parvenu — all either duplicate existing steps or have worse coverage/cost for small hospitality.

**Why:** Current stack (Firecrawl+Claude, Web Agent, ProxyCurl, BetterEnrich, Hunter) already covers everything these actors do, often more intelligently and at better cost.
