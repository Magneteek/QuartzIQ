/**
 * ProxyCurl API Client
 *
 * Enriches a LinkedIn profile URL → returns email + phone for that person.
 * Called when the Web Search Agent finds a LinkedIn URL for the owner.
 *
 * Credit costs (Starter plan: $0.020/credit):
 *  - Base profile lookup:      1 credit  ($0.020)
 *  - + personal email found:   1 credit  ($0.020) — only charged if found
 *  - + personal phone found:   1 credit  ($0.020) — only charged if found
 *  Max per call: 3 credits = $0.060 if both email + phone returned
 *  Min per call: 1 credit  = $0.020 (profile only, no contact data found)
 *
 * Uses `use_cache=if-present` to return cached data instantly without re-scraping.
 *
 * API docs: https://nubela.co/proxycurl/docs
 */

export interface ProxyCurlResult {
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  fullName: string | null
  title: string | null
  linkedinUrl: string
  creditsUsed: number
  costUsd: number
  durationMs: number
  success: boolean
  errorMessage?: string
}

export class ProxyCurlClient {
  private baseUrl = 'https://nubela.co/proxycurl/api/v2/linkedin'
  private costPerCredit = 0.020 // Starter plan

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('ProxyCurl API key is required')
  }

  /**
   * Fetch a LinkedIn profile and extract email + phone.
   * Always passes personal_email=include and personal_contact_number=include
   * so we get contact data in a single call.
   */
  async enrichFromLinkedIn(linkedinUrl: string): Promise<ProxyCurlResult> {
    const startTime = Date.now()

    try {
      const params = new URLSearchParams({
        linkedin_profile_url: linkedinUrl,
        use_cache: 'if-present',         // use cached data to save credits
        personal_email: 'include',        // +1 credit if personal email found
        personal_contact_number: 'include', // +1 credit if phone found
        infer_salary: 'skip',
        skills: 'exclude',
        recommendations: 'exclude',
        activities: 'exclude',
        certifications: 'exclude',
        publications: 'exclude',
        honors_awards: 'exclude',
        patents: 'exclude',
        courses: 'exclude',
        organizations: 'exclude',
      })

      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })

      if (response.status === 404) {
        return this.emptyResult(linkedinUrl, startTime, 0, 'Profile not found')
      }

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`ProxyCurl error: ${response.status} ${text}`)
      }

      const data = await response.json()

      // Extract best available email: work email preferred, then personal
      const workEmail = data.work_email || null
      const personalEmail = data.personal_emails?.[0] || null
      const email = workEmail || personalEmail

      // Extract best available phone
      const phone = data.personal_numbers?.[0] || null

      // Calculate credits: 1 base + 1 if email found + 1 if phone found
      const creditsUsed = 1 + (email ? 1 : 0) + (phone ? 1 : 0)

      const firstName = data.first_name || null
      const lastName = data.last_name || null
      const fullName = data.full_name || (firstName && lastName ? `${firstName} ${lastName}` : null)

      // Current occupation from most recent experience
      const currentExp = (data.experiences || []).find((e: any) => !e.ends_at)
      const title = data.occupation || currentExp?.title || null

      return {
        email,
        phone,
        firstName,
        lastName,
        fullName,
        title,
        linkedinUrl,
        creditsUsed,
        costUsd: creditsUsed * this.costPerCredit,
        durationMs: Date.now() - startTime,
        success: !!(email || phone),
      }
    } catch (error: any) {
      return this.emptyResult(linkedinUrl, startTime, 0, error.message)
    }
  }

  private emptyResult(
    linkedinUrl: string,
    startTime: number,
    creditsUsed: number,
    errorMessage?: string
  ): ProxyCurlResult {
    return {
      email: null,
      phone: null,
      firstName: null,
      lastName: null,
      fullName: null,
      title: null,
      linkedinUrl,
      creditsUsed,
      costUsd: creditsUsed * this.costPerCredit,
      durationMs: Date.now() - startTime,
      success: false,
      errorMessage,
    }
  }
}

export default ProxyCurlClient
