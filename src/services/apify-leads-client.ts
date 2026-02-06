/**
 * Apify Leads Enrichment Client
 *
 * Uses Apify's compass/crawler-google-places actor with leads enrichment add-on
 * to extract employee contact information from Google Maps business listings.
 *
 * Cost: $0.005 per lead found
 * Requires: place_id from the business
 */

import { ApifyClient } from 'apify-client'

export interface ApifyLead {
  name: string
  firstName?: string
  lastName?: string
  email?: string
  phoneNumber?: string
  jobTitle?: string
  linkedInUrl?: string
  department?: string
}

export interface ApifyLeadsResult {
  leads: ApifyLead[]
  leadsFound: number
  costUsd: number
  durationMs: number
  success: boolean
  error?: string
}

export class ApifyLeadsClient {
  private client: ApifyClient
  private apiToken: string

  constructor(apiToken: string) {
    this.apiToken = apiToken
    this.client = new ApifyClient({ token: apiToken })
  }

  /**
   * Enrich a business with employee leads data using place_id
   *
   * @param placeId - Google Maps place_id (e.g., "ChIJ...")
   * @param maxLeads - Maximum leads to extract per business (default: 1)
   * @param departments - Filter by departments (e.g., ["executive", "management"])
   * @returns Enrichment result with leads and cost
   */
  async enrichBusinessLeads(
    placeId: string,
    maxLeads: number = 1,
    departments?: string[]
  ): Promise<ApifyLeadsResult> {
    const startTime = Date.now()

    try {
      console.log(`[Apify Leads] Enriching business with place_id: ${placeId}`)
      console.log(`[Apify Leads] Max leads: ${maxLeads}`)

      // Configure actor input for leads enrichment
      const actorInput = {
        // Use place_id directly instead of searching
        startUrls: [{
          url: `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${placeId}`
        }],
        maxCrawledPlaces: 1,
        language: 'en',

        // Leads enrichment add-on configuration
        includeWebResults: false,
        maxLeadsPerPlace: maxLeads,
        leadsEnrichment: true, // Enable leads enrichment add-on

        // Optional: Filter by departments
        ...(departments && departments.length > 0 && {
          leadsDepartments: departments
        })
      }

      console.log('[Apify Leads] Starting actor with input:', JSON.stringify(actorInput, null, 2))

      // Run the actor
      const run = await this.client.actor('compass/crawler-google-places').call(actorInput, {
        waitSecs: 120, // Wait up to 2 minutes
      })

      console.log('[Apify Leads] Actor run completed:', run.id)
      console.log('[Apify Leads] Status:', run.status)

      // Get results from dataset
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems()

      if (!items || items.length === 0) {
        console.log('[Apify Leads] No results returned from actor')
        return {
          leads: [],
          leadsFound: 0,
          costUsd: 0,
          durationMs: Date.now() - startTime,
          success: false,
          error: 'No data returned from Apify'
        }
      }

      const business = items[0]
      console.log('[Apify Leads] Business found:', business.title)

      // Extract leads from the result
      const leads: ApifyLead[] = []

      if (business.leads && Array.isArray(business.leads)) {
        console.log(`[Apify Leads] Found ${business.leads.length} leads`)

        for (const lead of business.leads) {
          // Parse name into first/last
          const nameParts = lead.name?.split(' ') || []
          const firstName = nameParts[0] || ''
          const lastName = nameParts.slice(1).join(' ') || ''

          leads.push({
            name: lead.name || '',
            firstName,
            lastName,
            email: lead.email || lead.workEmail || null,
            phoneNumber: lead.phoneNumber || lead.phone || null,
            jobTitle: lead.jobTitle || lead.title || null,
            linkedInUrl: lead.linkedInUrl || lead.linkedin || null,
            department: lead.department || null,
          })
        }
      }

      // Calculate cost: $0.005 per lead found
      const leadsFound = leads.length
      const costPerLead = 0.005
      const costUsd = leadsFound * costPerLead

      console.log(`[Apify Leads] Successfully enriched with ${leadsFound} leads`)
      console.log(`[Apify Leads] Cost: $${costUsd.toFixed(4)}`)

      return {
        leads,
        leadsFound,
        costUsd,
        durationMs: Date.now() - startTime,
        success: leadsFound > 0,
        error: leadsFound === 0 ? 'No leads found for this business' : undefined
      }
    } catch (error: any) {
      console.error('[Apify Leads] Error:', error.message)

      return {
        leads: [],
        leadsFound: 0,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        success: false,
        error: error.message || 'Failed to enrich business leads'
      }
    }
  }

  /**
   * Get usage statistics (for monitoring)
   */
  getUsageStats() {
    return {
      apiToken: this.apiToken ? '***' + this.apiToken.slice(-4) : 'not configured',
    }
  }
}

export default ApifyLeadsClient
