/**
 * Contact Enrichment Orchestrator
 *
 * Coordinates the entire contact enrichment workflow:
 * 1. Claude website research (FREE - 30-40% success rate)
 * 2. Apify leads enrichment ($0.005 per lead - 25-35% success rate)
 * 3. Apollo Search API (if needed - find executives)
 * 4. Apollo Enrichment API (reveal contact details)
 * 5. Database storage and usage tracking
 *
 * Cost Optimization Strategy:
 * - Try Claude first (free) → saves 40% of API costs
 * - Try Apify second ($0.005) → saves 50-70% vs Apollo
 * - If Claude/Apify finds name → skip Apollo Search API
 * - Target 1 executive per business
 * - Track all API usage for cost analysis
 */

import { Pool, PoolClient } from 'pg';
import { ApolloClient, ApolloPerson, ApolloAPIUsage } from './apollo-client';
import { ClaudeWebsiteResearcher, ExecutiveInfo, WebsiteResearchResult } from './claude-website-researcher';
import { ApifyLeadsClient, ApifyLead, ApifyLeadsResult } from './apify-leads-client';
import { BetterEnrichClient } from './better-enrich-client';

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
  method: 'claude_only' | 'apify_only' | 'enrich_only' | 'search_then_enrich' | 'better_enrich';
  durationMs: number;
  error?: string;
}

export interface ContactEnrichment {
  business_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  title: string | null;
  seniority: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  apollo_person_id: string | null;
  apollo_search_cost: number;
  apollo_enrich_cost: number;
  apify_leads_cost: number;
  reveal_method: 'claude_only' | 'apify_only' | 'enrich_only' | 'search_then_enrich' | 'better_enrich';
  enrichment_status: 'completed' | 'failed';
  confidence_score: number;
  source: string;
}

/**
 * Contact Enrichment Orchestrator
 * Main coordinator for the enrichment workflow
 */
export class ContactEnrichmentOrchestrator {
  private apollo: ApolloClient;
  private claude: ClaudeWebsiteResearcher;
  private apify: ApifyLeadsClient | null;
  private betterEnrich: BetterEnrichClient | null;
  private db: Pool;

  constructor(
    apolloApiKey: string,
    apolloMonthlyLimit: number = 100,
    claudeApiKey?: string,
    apifyApiKey?: string,
    firecrawlApiKey?: string,
    betterEnrichApiKey?: string
  ) {
    // Initialize API clients
    this.apollo = new ApolloClient(apolloApiKey, apolloMonthlyLimit);
    this.claude = new ClaudeWebsiteResearcher(claudeApiKey, firecrawlApiKey);
    this.apify = apifyApiKey ? new ApifyLeadsClient(apifyApiKey) : null;
    this.betterEnrich = betterEnrichApiKey ? new BetterEnrichClient(betterEnrichApiKey) : null;

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
    const apiUsageLogs: ApolloAPIUsage[] = [];

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

        // Try Apollo Search directly
        return await this.enrichWithApolloSearchOnly(business, startTime);
      }

      const domain = ApolloClient.extractDomain(business.website);
      if (!domain) {
        throw new Error('Invalid website URL');
      }

      // 2. Try Claude Website Research First (FREE)
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

      // Read enrichment config for optional phone
      const includePhone = !!claudeResults // placeholder; real value comes from job config below

      // 3. Check if Claude found an executive with name
      if (claudeResults.executives.length > 0) {
        const executive = claudeResults.executives[0]; // Take the first/best one

        console.log(`\n✅ Claude found executive: ${executive.fullName}`);
        console.log(`   Title: ${executive.title || 'Unknown'}`);
        console.log(`   Confidence: ${executive.confidence}`);

        // Check if Claude also found email/phone (complete enrichment)
        if (executive.email) {
          console.log('🎯 Claude found complete contact info! No paid API needed.');

          await this.saveContact(business.id, {
            business_id: business.id,
            first_name: executive.firstName,
            last_name: executive.lastName,
            full_name: executive.fullName,
            title: executive.title || null,
            seniority: null,
            email: executive.email || null,
            phone: executive.phone || null,
            linkedin_url: executive.linkedinUrl || null,
            apollo_person_id: null,
            apollo_search_cost: 0,
            apollo_enrich_cost: 0,
            apify_leads_cost: 0,
            reveal_method: 'claude_only',
            enrichment_status: 'completed',
            confidence_score: executive.confidence,
            source: executive.source,
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

        // Claude found name but no email → try BetterEnrich first (cheaper)
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
              business_id: business.id,
              first_name: executive.firstName,
              last_name: executive.lastName,
              full_name: executive.fullName,
              title: executive.title || null,
              seniority: null,
              email: beResult.email,
              phone: executive.phone || null,
              linkedin_url: executive.linkedinUrl || null,
              apollo_person_id: null,
              apollo_search_cost: 0,
              apollo_enrich_cost: 0,
              apify_leads_cost: beResult.costUsd,
              reveal_method: 'better_enrich',
              enrichment_status: 'completed',
              confidence_score: executive.confidence,
              source: 'better_enrich',
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
            console.log('⚠️  BetterEnrich email lookup failed, falling back to Apollo...');
          }
        }

        // BetterEnrich failed or not configured → fall back to Apollo Enrichment
        console.log('📞 Fallback: Apollo Enrichment API...');
        const { person, usage } = await this.apollo.enrichPerson({
          first_name: executive.firstName,
          last_name: executive.lastName,
          domain: domain,
          organization_name: business.name,
          reveal_personal_emails: true,
          reveal_phone_number: true,
        });

        totalApiCalls += 1;
        totalCostUsd += usage.costUsd;
        apiUsageLogs.push(usage);
        await this.logApolloUsage(business.id, usage);

        if (person) {
          console.log('✅ Apollo enrichment successful!');
          console.log(`   Email: ${person.email || 'N/A'}`);
          console.log(`   Phone: ${person.phone_numbers?.length || 0} numbers found`);

          await this.saveContact(business.id, {
            business_id: business.id,
            first_name: person.first_name,
            last_name: person.last_name,
            full_name: person.name,
            title: person.title,
            seniority: person.seniority,
            email: person.email,
            phone: ApolloClient.formatPhoneNumber(person.phone_numbers),
            linkedin_url: person.linkedin_url,
            apollo_person_id: person.id,
            apollo_search_cost: 0,
            apollo_enrich_cost: usage.costUsd,
            apify_leads_cost: 0,
            reveal_method: 'enrich_only',
            enrichment_status: 'completed',
            confidence_score: executive.confidence,
            source: executive.source,
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
            method: 'enrich_only',
            durationMs,
          };
        } else {
          console.log('⚠️  Apollo enrichment failed, trying full search...');
        }
      }

      // 3. Try Apify Leads Enrichment ($0.005 per lead) - cheaper than Apollo!
      if (this.apify && business.place_id) {
        console.log('\n🔍 Step 2: Apify Leads Enrichment ($0.005 per lead)...');
        const apifyResult = await this.apify.enrichBusinessLeads(business.place_id, 1, ['executive', 'management']);

        totalApiCalls += 1; // Count as 1 API call
        totalCostUsd += apifyResult.costUsd;

        if (apifyResult.success && apifyResult.leads.length > 0) {
          const lead = apifyResult.leads[0];
          console.log(`✅ Apify found lead: ${lead.name}`);
          console.log(`   Email: ${lead.email || 'N/A'}`);
          console.log(`   Phone: ${lead.phoneNumber || 'N/A'}`);
          console.log(`   Title: ${lead.jobTitle || 'N/A'}`);

          // Save contact from Apify
          const contact = await this.saveContact(business.id, {
            business_id: business.id,
            first_name: lead.firstName || '',
            last_name: lead.lastName || '',
            full_name: lead.name,
            title: lead.jobTitle || null,
            seniority: null,
            email: lead.email || null,
            phone: lead.phoneNumber || null,
            linkedin_url: lead.linkedInUrl || null,
            apollo_person_id: null,
            apollo_search_cost: 0,
            apollo_enrich_cost: 0,
            apify_leads_cost: apifyResult.costUsd,
            reveal_method: 'apify_only',
            enrichment_status: 'completed',
            confidence_score: 0.85, // High confidence from Apify
            source: 'apify',
          });

          const durationMs = Date.now() - startTime;
          console.log(`\n✅ Enrichment complete via Apify! Cost: $${apifyResult.costUsd.toFixed(4)}`);

          return {
            success: true,
            businessId: business.id,
            businessName: business.name,
            executivesFound: 1,
            contactsEnriched: 1,
            totalApiCalls,
            totalCostUsd,
            method: 'apify_only',
            durationMs,
          };
        } else {
          console.log('⚠️  Apify enrichment failed or no leads found');
        }
      } else if (!this.apify) {
        console.log('⚠️  Apify not configured, skipping...');
      } else if (!business.place_id) {
        console.log('⚠️  No place_id available for Apify enrichment');
      }

      // 4. Claude & Apify failed → Full Apollo workflow (2 API calls)
      console.log('\n🔎 Step 3: Apollo Search API (finding executives)...');
      const { people, usage: searchUsage } = await this.apollo.searchPeopleByDomain(domain, 1);

      totalApiCalls += 1;
      totalCostUsd += searchUsage.costUsd;
      apiUsageLogs.push(searchUsage);
      await this.logApolloUsage(business.id, searchUsage);

      if (people.length === 0) {
        console.log('❌ No executives found in Apollo Search');

        const durationMs = Date.now() - startTime;
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
          error: 'No executives found',
        };
      }

      const topExecutive = people[0];
      console.log(`✅ Found executive: ${topExecutive.name}`);
      console.log(`   Title: ${topExecutive.title}`);
      console.log(`   Seniority: ${topExecutive.seniority}`);

      // 5. Enrich the found executive (2nd API call)
      console.log('\n📞 Step 3: Apollo Enrichment API (revealing contact details)...');
      const { person: enrichedPerson, usage: enrichUsage } = await this.apollo.enrichPerson({
        first_name: topExecutive.first_name,
        last_name: topExecutive.last_name,
        domain: domain,
        organization_name: business.name,
        reveal_personal_emails: true,
        reveal_phone_number: true,
      });

      totalApiCalls += 1;
      totalCostUsd += enrichUsage.costUsd;
      apiUsageLogs.push(enrichUsage);
      await this.logApolloUsage(business.id, enrichUsage);

      if (!enrichedPerson) {
        console.log('❌ Apollo enrichment failed');

        const durationMs = Date.now() - startTime;
        return {
          success: false,
          businessId: business.id,
          businessName: business.name,
          executivesFound: 1,
          contactsEnriched: 0,
          totalApiCalls,
          totalCostUsd,
          method: 'search_then_enrich',
          durationMs,
          error: 'Enrichment failed',
        };
      }

      console.log('✅ Apollo enrichment successful!');
      console.log(`   Email: ${enrichedPerson.email || 'N/A'}`);
      console.log(`   Phone: ${enrichedPerson.phone_numbers?.length || 0} numbers found`);

      // 6. Save enriched contact
      const contact = await this.saveContact(business.id, {
        business_id: business.id,
        first_name: enrichedPerson.first_name,
        last_name: enrichedPerson.last_name,
        full_name: enrichedPerson.name,
        title: enrichedPerson.title,
        seniority: enrichedPerson.seniority,
        email: enrichedPerson.email,
        phone: ApolloClient.formatPhoneNumber(enrichedPerson.phone_numbers),
        linkedin_url: enrichedPerson.linkedin_url,
        apollo_person_id: enrichedPerson.id,
        apollo_search_cost: searchUsage.costUsd,
        apollo_enrich_cost: enrichUsage.costUsd,
        apify_leads_cost: 0,
        reveal_method: 'search_then_enrich',
        enrichment_status: 'completed',
        confidence_score: 0.9,
        source: 'apollo',
      });

      const durationMs = Date.now() - startTime;
      console.log(`\n✅ Enrichment complete! Total cost: $${totalCostUsd.toFixed(4)}`);
      console.log(`   Duration: ${durationMs}ms`);
      console.log(`   API calls: ${totalApiCalls}`);

      return {
        success: true,
        businessId: business.id,
        businessName: business.name,
        executivesFound: 1,
        contactsEnriched: 1,
        totalApiCalls,
        totalCostUsd,
        method: 'search_then_enrich',
        durationMs,
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
        business_id, first_name, last_name, full_name, title, seniority,
        email, phone, linkedin_url, apollo_person_id,
        apollo_search_cost, apollo_enrich_cost, apify_leads_cost, reveal_method,
        enrichment_status, confidence_score, source, extracted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      RETURNING *`,
      [
        businessId,
        contact.first_name,
        contact.last_name,
        contact.full_name,
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
        contact.source,
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

    // Print Apollo API usage stats
    const usage = this.apollo.getUsageStats();
    console.log(`\n📈 Apollo API Usage:`);
    console.log(`   Total requests: ${usage.totalRequests}`);
    console.log(`   Monthly calls used: ${usage.monthlyCallsUsed}/${usage.monthlyLimit}`);
    console.log(`   Remaining calls: ${usage.remainingCalls}`);
    console.log(`   Utilization: ${usage.utilizationPercent}%`);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.db.end();
  }
}

export default ContactEnrichmentOrchestrator;
