/**
 * Hunter.io API Client
 *
 * Two endpoints used:
 *  1. Email Finder  — given name + domain → most likely work email + confidence
 *  2. Domain Search — given domain only   → email pattern + any known emails
 *
 * Pricing (pay-per-request, free tier: 25/month):
 *  - Each request costs 1 credit (~$0.005–0.015 depending on plan)
 *  - Only charged when a result is returned (unverified requests are free on some plans)
 *
 * Fits between BetterEnrich (waterfall lookup) and Apollo in the enrichment pipeline.
 * Particularly strong for small businesses: uses email pattern inference when the
 * person isn't in any B2B database.
 *
 * API docs: https://hunter.io/api-documentation
 */

export interface HunterEmailResult {
  email: string | null
  score: number          // 0–100 confidence score from Hunter
  sources: string[]
  verified: boolean
  firstName: string | null
  lastName: string | null
  position: string | null
  linkedinUrl: string | null
  creditsUsed: number
  costUsd: number
  durationMs: number
  success: boolean
  errorMessage?: string
}

export interface HunterDomainResult {
  emailPattern: string | null   // e.g. "firstname.lastname" or "firstinitial.lastname"
  emails: Array<{
    email: string
    score: number
    firstName: string | null
    lastName: string | null
    position: string | null
  }>
  creditsUsed: number
  costUsd: number
  durationMs: number
  success: boolean
  errorMessage?: string
}

export class HunterClient {
  private baseUrl = 'https://api.hunter.io/v2'
  private costPerCredit = 0.010 // ~$0.01 per request (conservative estimate)

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('Hunter.io API key is required')
  }

  /**
   * Find the most likely work email for a person at a company.
   * Uses name + domain — ideal when web research has already found the owner name.
   *
   * ~$0.01 per request
   */
  async findEmail(
    firstName: string,
    lastName: string,
    domain: string
  ): Promise<HunterEmailResult> {
    const startTime = Date.now()

    try {
      const params = new URLSearchParams({
        first_name: firstName,
        last_name: lastName,
        domain,
        api_key: this.apiKey,
      })

      const response = await fetch(`${this.baseUrl}/email-finder?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.errors?.[0]?.details || `Hunter API error: ${response.status}`)
      }

      const result = data.data
      const email = result?.email || null
      const score = result?.score || 0

      // Hunter considers score >= 50 reliable enough to use
      const success = !!email && score >= 50

      return {
        email: success ? email : null,
        score,
        sources: (result?.sources || []).map((s: any) => s.uri || s.domain).filter(Boolean),
        verified: result?.verification?.status === 'valid',
        firstName: result?.first_name || null,
        lastName: result?.last_name || null,
        position: result?.position || null,
        linkedinUrl: result?.linkedin || null,
        creditsUsed: success ? 1 : 0,
        costUsd: success ? this.costPerCredit : 0,
        durationMs: Date.now() - startTime,
        success,
      }
    } catch (error: any) {
      return {
        email: null,
        score: 0,
        sources: [],
        verified: false,
        firstName: null,
        lastName: null,
        position: null,
        linkedinUrl: null,
        creditsUsed: 0,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      }
    }
  }

  /**
   * Search all known emails for a domain + detect the email pattern.
   * Useful when we have a domain but no name, or to find the email format
   * so we can construct + verify an address ourselves.
   *
   * ~$0.01 per request
   */
  async domainSearch(domain: string): Promise<HunterDomainResult> {
    const startTime = Date.now()

    try {
      const params = new URLSearchParams({
        domain,
        api_key: this.apiKey,
        limit: '10',
      })

      const response = await fetch(`${this.baseUrl}/domain-search?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.errors?.[0]?.details || `Hunter API error: ${response.status}`)
      }

      const result = data.data
      const emails = (result?.emails || []).map((e: any) => ({
        email: e.value,
        score: e.confidence,
        firstName: e.first_name || null,
        lastName: e.last_name || null,
        position: e.position || null,
      }))

      return {
        emailPattern: result?.pattern || null,
        emails,
        creditsUsed: 1,
        costUsd: this.costPerCredit,
        durationMs: Date.now() - startTime,
        success: !!(result?.pattern || emails.length > 0),
      }
    } catch (error: any) {
      return {
        emailPattern: null,
        emails: [],
        creditsUsed: 0,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      }
    }
  }

  /**
   * Build an email address from a name + domain using a known pattern.
   * e.g. pattern "firstname.lastname" + "Michel Maertens" → "michel.maertens@hotelnavarra.com"
   */
  static buildEmail(firstName: string, lastName: string, domain: string, pattern: string): string {
    const f = firstName.toLowerCase()
    const l = lastName.toLowerCase()
    const fi = f[0]
    const li = l[0]

    const emailLocal: Record<string, string> = {
      'firstname.lastname':   `${f}.${l}`,
      'firstinitial.lastname': `${fi}.${l}`,
      'firstname.lastinitial': `${f}.${li}`,
      'firstname':             f,
      'lastname':              l,
      'firstnamelastname':    `${f}${l}`,
      'firstinitiallastname': `${fi}${l}`,
    }

    const local = emailLocal[pattern] ?? `${f}.${l}`
    return `${local}@${domain}`
  }
}

export default HunterClient
