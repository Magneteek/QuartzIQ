/**
 * Contact Enrichment Orchestrator
 *
 * Coordinates the entire contact enrichment workflow:
 * 1. Claude website research (FREE)
 * 2. Web Search Agent — owner name + phone + LinkedIn URL (~$0.02)
 *    └─ LinkedIn found? → EnrichLayer email + phone (~$0.02–0.06)
 * 3. BetterEnrich email lookup (~$0.031, pay-per-success)
 * 4. Hunter.io email finder (~$0.01, pay-per-success)
 * 5. GMB phone always available as fallback
 *
 * Disabled (low hit rate for small hospitality):
 * - Apollo: <10% hit rate, $0.10/call regardless of outcome
 * - Apify leads enrichment: low hit rate on small hotels (GBP rarely has staff profiles)
 *   Note: Apify IS still used for review scraping / business discovery — just not contact enrichment.
 */

import { Pool, PoolClient } from 'pg';
import { ApolloClient, ApolloPerson, ApolloAPIUsage } from './apollo-client';
import { ClaudeWebsiteResearcher, ExecutiveInfo, WebsiteResearchResult } from './claude-website-researcher';
import { ApifyLeadsClient, ApifyLead, ApifyLeadsResult } from './apify-leads-client';
import { BetterEnrichClient } from './better-enrich-client';
import { OwnerNameResearchAgent } from './owner-name-research-agent';
import { HunterClient } from './hunter-client';
import { EnrichLayerClient, EnrichLayerResult } from './enrichlayer-client';

export interface Business {
  id: string;
  place_id: string;
  name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country_code: string;
  rating: number | null;
  reviews_count: number | null;
}

export interface EnrichmentQueueItem {
  id: string;
  organization_id: string;
  business_id: string;
  business: Business;
  priority: number;
  target_executive_count: number;
  enrichment_config: any;
}

export interface EnrichmentResult {
  success: boolean;
  businessId: string;
  businessName: string;
  executivesFound: number;
  contactsEnriched: number;
  totalApiCalls: number;
  totalCostUsd: number;
  method: 'claude_only' | 'apify_only' | 'enrich_only' | 'search_then_enrich' | 'better_enrich' | 'web_research';
  durationMs: number;
  error?: string;
}

export interface ContactEnrichment {
  business_id: string;
  owner_name: string;
  title: string | null;
  seniority: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  apollo_person_id: string | null;
  apollo_search_cost: number;
  apollo_enrich_cost: number;
  apify_leads_cost: number;
  reveal_method: 'claude_only' | 'apify_only' | 'enrich_only' | 'search_then_enrich' | 'better_enrich' | 'web_research';
  enrichment_status: 'completed' | 'partial' | 'failed';
  confidence_score: number;
  enrichment_source: string;
}

/**
 * Contact Enrichment Orchestrator
 * Main coordinator for the enrichment workflow
 */
export class ContactEnrichmentOrchestrator {
  private apollo: ApolloClient;
  // Apollo disabled: <10% hit rate for small hospitality businesses, $0.10/call regardless of outcome.
  // Re-enable if targeting larger B2B companies by setting this to false.
  private apolloDisabled = true;
  // Apify leads enrichment disabled: low hit rate on small hotels (GBP rarely has staff profiles).
  // Apify is still used for review scraping / business discovery — just not contact enrichment.
  // Re-enable by setting this to false.
  private apifyEnrichmentDisabled = true;
  private claude: ClaudeWebsiteResearcher;
  private apify: ApifyLeadsClient | null;
  private betterEnrich: BetterEnrichClient | null;
  private ownerNameAgent: OwnerNameResearchAgent | null;
  private hunter: HunterClient | null;
  private enrichLayer: EnrichLayerClient | null;
  private db: Pool;

  constructor(
    apolloApiKey: string,
    apolloMonthlyLimit: number = 100,
    claudeApiKey?: string,
    apifyApiKey?: string,
    firecrawlApiKey?: string,
    betterEnrichApiKey?: string,
    hunterApiKey?: string,
    enrichLayerApiKey?: string
  ) {
    // Initialize API clients
    this.apollo = new ApolloClient(apolloApiKey, apolloMonthlyLimit);
    this.claude = new ClaudeWebsiteResearcher(claudeApiKey, firecrawlApiKey);
    this.apify = apifyApiKey ? new ApifyLeadsClient(apifyApiKey) : null;
    this.betterEnrich = betterEnrichApiKey ? new BetterEnrichClient(betterEnrichApiKey) : null;
    this.ownerNameAgent = claudeApiKey ? new OwnerNameResearchAgent(claudeApiKey) : null;
    this.hunter = hunterApiKey ? new HunterClient(hunterApiKey) : null;
    this.enrichLayer = enrichLayerApiKey ? new EnrichLayerClient(enrichLayerApiKey) : null;

    // Initialize database connection
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
  }

  /**
   * Enrich a single business with executive contact information
   *
   * Workflow:
   * 1. Get business details from database
   * 2. Try Claude website research (FREE)
   * 3. If Claude succeeds → Enrich with Apollo (1 API call)
   * 4. If Claude fails → Search + Enrich with Apollo (2 API calls)
   * 5. Save contacts to database
   * 6. Log API usage and costs
   *
   * @param businessId - UUID of the business to enrich
   * @returns Enrichment result with costs and contact info
   */
  async enrichBusiness(businessId: string): Promise<EnrichmentResult> {
    const startTime = Date.now();
    let totalApiCalls = 0;
    let totalCostUsd = 0;

    // Tracks the best name+phone+linkedin found even when email lookup fails.
    // Saved as a partial contact at the end if no full enrichment succeeded.
    let partialContact: ContactEnrichment | null = null;

    console.log(`\n🔍 Starting enrichment for business: ${businessId}`);

    try {
      // 1. Get business details from database
      const business = await this.getBusiness(businessId);
      if (!business) {
        throw new Error(`Business not found: ${businessId}`);
      }

      console.log(`📊 Business: ${business.name}`);
      console.log(`🌐 Website: ${business.website || 'N/A'}`);

      if (!business.website) {
        console.log('⚠️  No website available, skipping Claude research');
        return await this.enrichWithApolloSearchOnly(business, startTime);
      }

      const domain = ApolloClient.extractDomain(business.website);
      if (!domain) {
        throw new Error('Invalid website URL');
      }

      // ── Tier 1: Claude Website Research (FREE) ──────────────────────────
      console.log('🤖 Step 1: Claude website research (FREE)...');
      const claudeResults = await this.claude.researchWebsite(
        business.website,
        business.name,
        domain
      );

      console.log(`   Found ${claudeResults.executives.length} executives`);
      console.log(`   Found ${claudeResults.emailPatterns.length} email patterns`);
      console.log(`   Found ${claudeResults.companyEmails.length} company emails`);
      console.log(`   Duration: ${claudeResults.durationMs}ms`);

      if (claudeResults.executives.length > 0) {
        const executive = claudeResults.executives[0];

        console.log(`\n✅ Claude found executive: ${executive.fullName}`);
        console.log(`   Title: ${executive.title || 'Unknown'}`);
        console.log(`   Confidence: ${executive.confidence}`);

        // Track as best partial so far
        partialContact = {
          business_id: business.id,
          owner_name: executive.fullName,
          title: executive.title || null,
          seniority: null,
          email: null,
          phone: executive.phone || null,
          linkedin_url: executive.linkedinUrl || null,
          apollo_person_id: null,
          apollo_search_cost: 0,
          apollo_enrich_cost: 0,
          apify_leads_cost: 0,
          reveal_method: 'claude_only',
          enrichment_status: 'partial',
          confidence_score: executive.confidence,
          enrichment_source: 'claude',
        };

        // Only reject truly impersonal addresses (no-reply, donotreply, noreply).
        // For small businesses, info@/contact@/office@ is often read by the owner directly.
        const impersonalPrefixes = ['noreply', 'no-reply', 'donotreply', 'do-not-reply', 'unsubscribe', 'bounce'];
        const isUsableEmail = executive.email &&
          !impersonalPrefixes.some(p => executive.email!.toLowerCase().startsWith(p));

        if (isUsableEmail) {
          const isPersonal = !['info', 'contact', 'mail', 'hello', 'office', 'admin', 'reception', 'reservations', 'booking']
            .some(p => executive.email!.toLowerCase().startsWith(p + '@'));
          console.log(`🎯 Claude found ${isPersonal ? 'personal' : 'company'} email on website! No paid API needed.`);

          await this.saveContact(business.id, {
            ...partialContact,
            email: executive.email!,
            enrichment_status: 'completed',
            enrichment_source: isPersonal ? 'claude' : 'company_email',
          });

          const durationMs = Date.now() - startTime;
          return {
            success: true,
            businessId: business.id,
            businessName: business.name,
            executivesFound: 1,
            contactsEnriched: 1,
            totalApiCalls: 0,
            totalCostUsd: 0,
            method: 'claude_only',
            durationMs,
          };
        }

        // Claude found name but no email → try BetterEnrich
        if (this.betterEnrich) {
          console.log('📧 Step 2: BetterEnrich email lookup (~$0.031)...');
          const beResult = await this.betterEnrich.findWorkEmail(
            executive.fullName,
            domain,
            executive.linkedinUrl
          );

          totalApiCalls += 1;
          totalCostUsd += beResult.costUsd;

          if (beResult.success && beResult.email) {
            console.log(`✅ BetterEnrich found email: ${beResult.email}`);
            console.log(`   Cost: $${beResult.costUsd.toFixed(4)}`);

            await this.saveContact(business.id, {
              ...partialContact,
              email: beResult.email,
              apify_leads_cost: beResult.costUsd,
              reveal_method: 'better_enrich',
              enrichment_status: 'completed',
              enrichment_source: 'better_enrich',
            });

            const durationMs = Date.now() - startTime;
            return {
              success: true,
              businessId: business.id,
              businessName: business.name,
              executivesFound: 1,
              contactsEnriched: 1,
              totalApiCalls,
              totalCostUsd,
              method: 'better_enrich',
              durationMs,
            };
          } else {
            console.log('⚠️  BetterEnrich email lookup failed, trying Hunter.io...');
          }
        }

        // BetterEnrich failed → try Hunter.io
        if (this.hunter) {
          console.log('🎯 Hunter.io email finder (~$0.01)...');
          const hunterResult = await this.hunter.findEmail(
            executive.firstName,
            executive.lastName,
            domain
          );

          totalApiCalls += 1;
          totalCostUsd += hunterResult.costUsd;

          if (hunterResult.success && hunterResult.email) {
            console.log(`✅ Hunter found email: ${hunterResult.email} (score: ${hunterResult.score})`);

            await this.saveContact(business.id, {
              ...partialContact,
              email: hunterResult.email,
              linkedin_url: hunterResult.linkedinUrl || executive.linkedinUrl || null,
              apify_leads_cost: hunterResult.costUsd,
              reveal_method: 'better_enrich',
              enrichment_status: 'completed',
              confidence_score: hunterResult.score / 100,
              enrichment_source: 'hunter',
            });

            const durationMs = Date.now() - startTime;
            return {
              success: true,
              businessId: business.id,
              businessName: business.name,
              executivesFound: 1,
              contactsEnriched: 1,
              totalApiCalls,
              totalCostUsd,
              method: 'better_enrich',
              durationMs,
            };
          } else {
            console.log('⚠️  Hunter email finder failed, no further email sources available.');
          }
        }
      }

      // ── Tier 2: Web Search Agent (~$0.02) ───────────────────────────────
      if (this.ownerNameAgent) {
        console.log('\n🌐 Step 2: Web Search Agent — hunting owner name...');
        const webResult = await this.ownerNameAgent.findOwnerName(
          business.name,
          domain,
          business.city,
          business.country_code
        );

        console.log(`   Duration: ${webResult.durationMs}ms`);

        if (webResult.success && webResult.fullName) {
          console.log(`✅ Web agent found: ${webResult.fullName} (${webResult.title || 'unknown title'})`);
          console.log(`   Confidence: ${webResult.confidence}`);
          console.log(`   Sources: ${webResult.sources.join(', ')}`);

          // Update partial if web agent found better data (higher confidence or adds phone/linkedin)
          if (!partialContact || webResult.confidence >= partialContact.confidence_score) {
            partialContact = {
              business_id: business.id,
              owner_name: webResult.fullName,
              title: webResult.title || null,
              seniority: null,
              email: null,
              phone: webResult.phone || partialContact?.phone || null,
              linkedin_url: webResult.linkedinUrl || partialContact?.linkedin_url || null,
              apollo_person_id: null,
              apollo_search_cost: 0,
              apollo_enrich_cost: 0,
              apify_leads_cost: 0,
              reveal_method: 'web_research',
              enrichment_status: 'partial',
              confidence_score: webResult.confidence,
              enrichment_source: 'web_research',
            };
          }

          // Step 2b: EnrichLayer — if LinkedIn URL found (~$0.02–0.06)
          if (this.enrichLayer && webResult.linkedinUrl) {
            console.log('🔗 Step 2b: EnrichLayer LinkedIn enrichment (~$0.02–0.06)...');
            const pcResult = await this.enrichLayer.enrichFromLinkedIn(webResult.linkedinUrl);

            totalApiCalls += 1;
            totalCostUsd += pcResult.costUsd;

            // Update partial with any phone EnrichLayer found
            if (pcResult.phone) {
              partialContact = { ...partialContact!, phone: pcResult.phone };
            }

            if (pcResult.success && (pcResult.email || pcResult.phone)) {
              console.log(`✅ EnrichLayer found — email: ${pcResult.email || 'n/a'}, phone: ${pcResult.phone || 'n/a'}`);
              console.log(`   Credits used: ${pcResult.creditsUsed}, cost: $${pcResult.costUsd.toFixed(4)}`);

              await this.saveContact(business.id, {
                ...partialContact!,
                owner_name: pcResult.fullName || webResult.fullName,
                title: pcResult.title || webResult.title || null,
                email: pcResult.email || null,
                phone: pcResult.phone || webResult.phone || null,
                apify_leads_cost: pcResult.costUsd,
                enrichment_status: pcResult.email ? 'completed' : 'partial',
                enrichment_source: 'web_research+enrichlayer',
              });

              const durationMs = Date.now() - startTime;
              return {
                success: true,
                businessId: business.id,
                businessName: business.name,
                executivesFound: 1,
                contactsEnriched: 1,
                totalApiCalls,
                totalCostUsd,
                method: 'web_research',
                durationMs,
              };
            } else {
              console.log('⚠️  EnrichLayer found no contact data, continuing...');
            }
          }

          // Step 2c: BetterEnrich with web-discovered name
          if (this.betterEnrich) {
            console.log('📧 Step 2c: BetterEnrich email lookup with discovered name (~$0.031)...');
            const beResult = await this.betterEnrich.findWorkEmail(
              webResult.fullName,
              domain,
              webResult.linkedinUrl || undefined
            );

            totalApiCalls += 1;
            totalCostUsd += beResult.costUsd;

            if (beResult.success && beResult.email) {
              console.log(`✅ BetterEnrich found email: ${beResult.email}`);

              await this.saveContact(business.id, {
                ...partialContact!,
                email: beResult.email,
                apify_leads_cost: beResult.costUsd,
                enrichment_status: 'completed',
                enrichment_source: 'web_research+better_enrich',
              });

              const durationMs = Date.now() - startTime;
              return {
                success: true,
                businessId: business.id,
                businessName: business.name,
                executivesFound: 1,
                contactsEnriched: 1,
                totalApiCalls,
                totalCostUsd,
                method: 'web_research',
                durationMs,
              };
            } else {
              console.log('⚠️  BetterEnrich email lookup failed for web-discovered name, trying Hunter...');
            }
          }

          // Step 2d: Hunter.io with web-discovered name
          if (this.hunter && webResult.firstName && webResult.lastName) {
            console.log('🎯 Step 2d: Hunter.io email finder with web-discovered name (~$0.01)...');
            const hunterResult = await this.hunter.findEmail(
              webResult.firstName,
              webResult.lastName,
              domain
            );

            totalApiCalls += 1;
            totalCostUsd += hunterResult.costUsd;

            if (hunterResult.success && hunterResult.email) {
              console.log(`✅ Hunter found email: ${hunterResult.email} (score: ${hunterResult.score})`);

              await this.saveContact(business.id, {
                ...partialContact!,
                email: hunterResult.email,
                linkedin_url: hunterResult.linkedinUrl || webResult.linkedinUrl || null,
                apify_leads_cost: hunterResult.costUsd,
                enrichment_status: 'completed',
                confidence_score: hunterResult.score / 100,
                enrichment_source: 'web_research+hunter',
              });

              const durationMs = Date.now() - startTime;
              return {
                success: true,
                businessId: business.id,
                businessName: business.name,
                executivesFound: 1,
                contactsEnriched: 1,
                totalApiCalls,
                totalCostUsd,
                method: 'web_research',
                durationMs,
              };
            } else {
              console.log('⚠️  Hunter email finder failed, no further email sources available.');
            }
          }
        } else {
          console.log('⚠️  Web agent could not find owner name.');
        }
      }

      // Apify leads enrichment disabled — low hit rate on small hotels.
      // (Apify is still used for review scraping; this only disables contact enrichment.)

      // ── Company email fallback ────────────────────────────────────────────
      // All personal email tiers exhausted. For small businesses the company inbox
      // (info@, contact@) is typically read by the owner — use it rather than leaving blank.
      const impersonal = ['noreply', 'no-reply', 'donotreply', 'unsubscribe', 'bounce'];
      const fallbackEmail = claudeResults.companyEmails?.find(
        e => !impersonal.some(p => e.toLowerCase().startsWith(p))
      ) || null;

      const fallbackBase = partialContact ?? {
        business_id: business.id,
        owner_name: business.name,
        title: null,
        seniority: null,
        email: null,
        phone: business.phone || null,
        linkedin_url: null,
        apollo_person_id: null,
        apollo_search_cost: 0,
        apollo_enrich_cost: 0,
        apify_leads_cost: 0,
        reveal_method: 'claude_only' as const,
        enrichment_status: 'partial' as const,
        confidence_score: 0.5,
        enrichment_source: 'company_email',
      };

      if (fallbackEmail) {
        console.log(`\n📧 Using company email fallback: ${fallbackEmail}`);
        await this.saveContact(business.id, {
          ...fallbackBase,
          email: fallbackEmail,
          enrichment_status: 'completed',
          enrichment_source: 'company_email',
        });
        const durationMs = Date.now() - startTime;
        return {
          success: true,
          businessId: business.id,
          businessName: business.name,
          executivesFound: 1,
          contactsEnriched: 1,
          totalApiCalls,
          totalCostUsd,
          method: 'web_research',
          durationMs,
        };
      }

      // ── Partial save: we found a name but no email ───────────────────────
      const durationMs = Date.now() - startTime;
      if (partialContact) {
        console.log(`\n💾 Saving partial contact: ${partialContact.owner_name} (no email found)`);
        await this.saveContact(business.id, partialContact);

        return {
          success: true,
          businessId: business.id,
          businessName: business.name,
          executivesFound: 1,
          contactsEnriched: 1,
          totalApiCalls,
          totalCostUsd,
          method: 'web_research',
          durationMs,
        };
      }

      console.log(`\n⚠️  All enrichment layers exhausted. No contact found.`);
      console.log(`   Duration: ${durationMs}ms | Cost: $${totalCostUsd.toFixed(4)}`);

      return {
        success: false,
        businessId: business.id,
        businessName: business.name,
        executivesFound: 0,
        contactsEnriched: 0,
        totalApiCalls,
        totalCostUsd,
        method: 'search_then_enrich',
        durationMs,
        error: 'No contact found across all enrichment layers',
      };
    } catch (error: any) {
      console.error('❌ Enrichment error:', error.message);

      const durationMs = Date.now() - startTime;
      return {
        success: false,
        businessId,
        businessName: 'Unknown',
        executivesFound: 0,
        contactsEnriched: 0,
        totalApiCalls,
        totalCostUsd,
        method: 'search_then_enrich',
        durationMs,
        error: error.message,
      };
    }
  }

  /**
   * Enrich with Apollo Search only (no website available)
   */
  private async enrichWithApolloSearchOnly(business: Business, startTime: number): Promise<EnrichmentResult> {
    console.log('🔎 Trying Apollo Search with business name only...');

    // This is a fallback when no website is available
    // Not implemented yet - would require different search approach

    const durationMs = Date.now() - startTime;
    return {
      success: false,
      businessId: business.id,
      businessName: business.name,
      executivesFound: 0,
      contactsEnriched: 0,
      totalApiCalls: 0,
      totalCostUsd: 0,
      method: 'search_then_enrich',
      durationMs,
      error: 'No website available for enrichment',
    };
  }

  /**
   * Get business details from database
   */
  private async getBusiness(businessId: string): Promise<Business | null> {
    const result = await this.db.query(
      `SELECT id, place_id, name, website, phone, address, city, country_code, rating, reviews_count
       FROM businesses
       WHERE id = $1`,
      [businessId]
    );

    return result.rows[0] || null;
  }

  /**
   * Save enriched contact to database
   */
  private async saveContact(businessId: string, contact: ContactEnrichment): Promise<any> {
    const result = await this.db.query(
      `INSERT INTO contact_enrichments (
        business_id, owner_name, title, seniority,
        email, phone, linkedin_url, apollo_person_id,
        apollo_search_cost, apollo_enrich_cost, apify_leads_cost, reveal_method,
        enrichment_status, confidence_score, enrichment_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (business_id) DO UPDATE SET
        owner_name = EXCLUDED.owner_name,
        title = EXCLUDED.title,
        email = COALESCE(EXCLUDED.email, contact_enrichments.email),
        phone = COALESCE(EXCLUDED.phone, contact_enrichments.phone),
        linkedin_url = COALESCE(EXCLUDED.linkedin_url, contact_enrichments.linkedin_url),
        reveal_method = EXCLUDED.reveal_method,
        enrichment_status = EXCLUDED.enrichment_status,
        confidence_score = EXCLUDED.confidence_score,
        enrichment_source = EXCLUDED.enrichment_source,
        updated_at = NOW()
      RETURNING *`,
      [
        businessId,
        contact.owner_name,
        contact.title,
        contact.seniority,
        contact.email,
        contact.phone,
        contact.linkedin_url,
        contact.apollo_person_id,
        contact.apollo_search_cost,
        contact.apollo_enrich_cost,
        contact.apify_leads_cost,
        contact.reveal_method,
        contact.enrichment_status,
        contact.confidence_score,
        contact.enrichment_source,
      ]
    );

    // Write enriched data back to the businesses table so the UI reflects results
    const TITLE_PREFIXES = /^(dr|drs|prof|mr|mrs|ms|ir|ing|dhr|mevr)\.?\s+/i;
    const cleanedName = contact.owner_name.trim().replace(TITLE_PREFIXES, '');
    const nameParts = cleanedName.split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const bizStatus = contact.enrichment_status === 'completed' ? 'completed' : 'in_progress';

    await this.db.query(
      `UPDATE businesses SET
        first_name = $1,
        last_name = $2,
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        enrichment_status = $5,
        enrichment_confidence = $6,
        last_updated_at = NOW()
       WHERE id = $7`,
      [
        firstName,
        lastName,
        contact.email,
        contact.phone,
        bizStatus,
        Math.round(contact.confidence_score * 100),
        businessId,
      ]
    );

    return result.rows[0];
  }

  /**
   * Log Apollo API usage to database
   */
  private async logApolloUsage(businessId: string, usage: ApolloAPIUsage): Promise<void> {
    await this.db.query(
      `INSERT INTO apollo_api_log (
        business_id, api_endpoint, credits_used, cost_usd,
        success, duration_ms, error_message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        businessId,
        usage.endpoint,
        usage.creditsUsed,
        usage.costUsd,
        usage.success,
        usage.durationMs,
        usage.errorMessage || null,
      ]
    );
  }

  /**
   * Get next enrichment job from queue
   */
  async getNextEnrichmentJob(): Promise<EnrichmentQueueItem | null> {
    const result = await this.db.query(
      `SELECT
        eq.id as queue_id,
        eq.organization_id,
        eq.business_id,
        eq.priority,
        eq.target_executive_count,
        eq.enrichment_config,
        b.id as business_id_actual,
        b.place_id,
        b.name,
        b.website,
        b.phone,
        b.address,
        b.city,
        b.country_code,
        b.rating,
        b.reviews_count
      FROM enrichment_queue eq
      INNER JOIN businesses b ON b.id = eq.business_id
      WHERE eq.status = 'queued'
      ORDER BY eq.priority DESC, eq.queued_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED`
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.queue_id,
      organization_id: row.organization_id,
      business_id: row.business_id,
      priority: row.priority,
      target_executive_count: row.target_executive_count,
      enrichment_config: row.enrichment_config,
      business: {
        id: row.business_id_actual,
        place_id: row.place_id,
        name: row.name,
        website: row.website,
        phone: row.phone,
        address: row.address,
        city: row.city,
        country_code: row.country_code,
        rating: row.rating,
        reviews_count: row.reviews_count,
      },
    };
  }

  /**
   * Update enrichment queue status
   */
  async updateQueueStatus(
    queueId: string,
    status: 'processing' | 'completed' | 'failed',
    result?: EnrichmentResult
  ): Promise<void> {
    if (status === 'processing') {
      await this.db.query(
        `UPDATE enrichment_queue
         SET status = $1, started_at = NOW()
         WHERE id = $2`,
        [status, queueId]
      );
    } else {
      await this.db.query(
        `UPDATE enrichment_queue
         SET status = $1,
             completed_at = NOW(),
             executives_found = $2,
             total_api_calls = $3,
             total_cost_usd = $4,
             error_message = $5
         WHERE id = $6`,
        [
          status,
          result?.executivesFound || 0,
          result?.totalApiCalls || 0,
          result?.totalCostUsd || 0,
          result?.error || null,
          queueId,
        ]
      );
    }
  }

  /**
   * Process enrichment queue (worker function)
   * Continuously processes jobs from the queue
   */
  async processQueue(maxJobs: number = 10): Promise<void> {
    console.log(`\n🚀 Starting queue processor (max ${maxJobs} jobs)...\n`);

    let processedJobs = 0;

    while (processedJobs < maxJobs) {
      // Get next job from queue
      const job = await this.getNextEnrichmentJob();

      if (!job) {
        console.log('✅ No more jobs in queue');
        break;
      }

      console.log(`\n📦 Processing job ${processedJobs + 1}/${maxJobs}`);
      console.log(`   Queue ID: ${job.id}`);
      console.log(`   Business: ${job.business.name}`);

      // Update status to processing
      await this.updateQueueStatus(job.id, 'processing');

      // Enrich the business
      const result = await this.enrichBusiness(job.business_id);

      // Update queue with result
      await this.updateQueueStatus(
        job.id,
        result.success ? 'completed' : 'failed',
        result
      );

      processedJobs++;

      // Log summary
      console.log(`\n📊 Job ${processedJobs} Summary:`);
      console.log(`   Success: ${result.success ? '✅' : '❌'}`);
      console.log(`   Contacts: ${result.contactsEnriched}`);
      console.log(`   API Calls: ${result.totalApiCalls}`);
      console.log(`   Cost: $${result.totalCostUsd.toFixed(4)}`);
      console.log(`   Duration: ${result.durationMs}ms`);

      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }

    console.log(`\n✅ Queue processing complete! Processed ${processedJobs} jobs.`);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.db.end();
  }
}

export default ContactEnrichmentOrchestrator;
