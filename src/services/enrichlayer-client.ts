/**
 * EnrichLayer API Client
 *
 * Enriches a LinkedIn profile URL → returns email + phone for that person.
 * Drop-in replacement for ProxyCurl (shut down July 2025).
 *
 * Endpoint: GET https://enrichlayer.com/api/v2/profile
 * Credit costs (Starter plan ~$0.017/credit):
 *  - Base profile lookup:      1 credit
 *  - + personal email found:   1 credit per email (only charged if found)
 *  - + personal phone found:   1 credit per number (only charged if found)
 *
 * API docs: https://enrichlayer.com/docs/api/v2/people-api/person-profile
 */

export interface EnrichLayerResult {
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

export class EnrichLayerClient {
  private baseUrl = 'https://enrichlayer.com/api/v2/profile'
  private costPerCredit = 0.017 // Starter plan

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('EnrichLayer API key is required')
  }

  /**
   * Fetch a LinkedIn profile and extract email + phone.
   */
  async enrichFromLinkedIn(linkedinUrl: string): Promise<EnrichLayerResult> {
    const startTime = Date.now()

    try {
      const params = new URLSearchParams({
        profile_url: linkedinUrl,
        use_cache: 'if-present',
        personal_email: 'include',
        personal_contact_number: 'include',
        skills: 'exclude',
        infer_salary: 'skip',
      })

      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })

      if (response.status === 404) {
        return this.emptyResult(linkedinUrl, startTime, 0, 'Profile not found')
      }

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`EnrichLayer error: ${response.status} ${text}`)
      }

      const data = await response.json()

      // Extract best available email: personal emails array
      const personalEmails: string[] = data.personal_emails || (data.personal_email ? [data.personal_email] : [])
      const email = personalEmails[0] || null

      // Extract best available phone
      const phones: string[] = data.personal_numbers || (data.personal_contact_number ? [data.personal_contact_number] : [])
      const phone = phones[0] || null

      // Credits: 1 base + 1 per email found + 1 per phone found
      const creditsUsed = 1 + (email ? 1 : 0) + (phone ? 1 : 0)

      const firstName = data.first_name || null
      const lastName = data.last_name || null
      const fullName = data.full_name || (firstName && lastName ? `${firstName} ${lastName}` : null)

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
  ): EnrichLayerResult {
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

export default EnrichLayerClient
