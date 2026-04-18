/**
 * BetterEnrich API Client
 *
 * Waterfall enrichment across 17+ data sources.
 * Pay-per-success: credits only charged on verified finds.
 *
 * Pricing:
 * - Email: 1.25 credits = ~$0.031
 * - Phone: 16 credits   = ~$0.40
 *
 * API docs: https://betterenrich.readme.io
 */

export interface BetterEnrichResult {
  email: string | null
  phone: string | null
  creditsUsed: number
  costUsd: number
  success: boolean
  durationMs: number
  errorMessage?: string
}

export class BetterEnrichClient {
  private baseUrl = 'https://app.betterenrich.com/api/v1'
  private creditCostPerEmail = 1.25 * 0.025  // $0.03125
  private creditCostPerPhone = 16 * 0.025     // $0.40
  private pollIntervalMs = 3000
  private pollTimeoutMs = 120000 // 2 min — waterfall across 17 sources can take ~60s

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('BetterEnrich API key is required')
  }

  /**
   * Find work email by name + company domain
   * ~$0.031 per verified email found
   */
  async findWorkEmail(
    fullName: string,
    companyDomain: string,
    linkedinUrl?: string
  ): Promise<BetterEnrichResult> {
    const startTime = Date.now()

    try {
      const body: Record<string, string> = { full_name: fullName, company_domain: companyDomain }
      if (linkedinUrl) body.linkedinURL = linkedinUrl

      const taskId = await this.submitTask('find-work-email', body)
      const result = await this.pollForResult('find-work-email', taskId)

      const email = result?.email || result?.work_email || null
      const durationMs = Date.now() - startTime

      return {
        email,
        phone: null,
        creditsUsed: email ? 1.25 : 0,
        costUsd: email ? this.creditCostPerEmail : 0,
        success: !!email,
        durationMs,
      }
    } catch (error: any) {
      return {
        email: null,
        phone: null,
        creditsUsed: 0,
        costUsd: 0,
        success: false,
        durationMs: Date.now() - startTime,
        errorMessage: error.message,
      }
    }
  }

  /**
   * Find mobile phone number (requires LinkedIn URL)
   * ~$0.40 per verified phone found
   */
  async findMobilePhone(
    fullName: string,
    companyDomain: string,
    linkedinUrl?: string
  ): Promise<BetterEnrichResult> {
    const startTime = Date.now()

    try {
      const body: Record<string, string> = {
        full_name: fullName,
        company_domain: companyDomain,
      }
      if (linkedinUrl) body.linkedinURL = linkedinUrl

      const taskId = await this.submitTask('find-mobile-phone-number', body)
      const result = await this.pollForResult('find-mobile-phone-number', taskId)

      const phone = result?.phone_number || result?.mobile_phone || null
      const durationMs = Date.now() - startTime

      return {
        email: null,
        phone,
        creditsUsed: phone ? 16 : 0,
        costUsd: phone ? this.creditCostPerPhone : 0,
        success: !!phone,
        durationMs,
      }
    } catch (error: any) {
      return {
        email: null,
        phone: null,
        creditsUsed: 0,
        costUsd: 0,
        success: false,
        durationMs: Date.now() - startTime,
        errorMessage: error.message,
      }
    }
  }

  /**
   * Submit a task and return the task ID
   */
  private async submitTask(endpoint: string, body: Record<string, string>): Promise<string> {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`BetterEnrich ${endpoint} failed: ${response.status} ${text}`)
    }

    const data = await response.json()

    if (!data.id) {
      throw new Error(`BetterEnrich ${endpoint}: no task ID in response`)
    }

    return data.id
  }

  /**
   * Poll for task result until complete or timeout
   */
  private async pollForResult(endpoint: string, taskId: string): Promise<Record<string, any> | null> {
    const deadline = Date.now() + this.pollTimeoutMs

    while (Date.now() < deadline) {
      const response = await fetch(`${this.baseUrl}/${endpoint}?id=${taskId}`, {
        headers: { Authorization: this.apiKey },
      })

      if (response.status === 202) {
        // Still processing
        await this.sleep(this.pollIntervalMs)
        continue
      }

      if (response.status === 200) {
        return await response.json()
      }

      const text = await response.text()
      throw new Error(`BetterEnrich poll failed: ${response.status} ${text}`)
    }

    throw new Error('BetterEnrich poll timeout after 30s')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export default BetterEnrichClient
