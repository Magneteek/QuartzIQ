/**
 * Owner Name Research Agent
 *
 * Uses Claude with web_search to discover the owner/manager name
 * of small local businesses from public web sources.
 *
 * Designed for micro businesses (hotels, restaurants, contractors)
 * that are NOT in B2B databases like Apollo or BetterEnrich.
 *
 * Searches:
 * - Google for "[business] owner" / "[business] manager"
 * - Google Maps / TripAdvisor owner review responses
 * - Facebook/Instagram business pages
 * - Local news articles mentioning the owner
 * - LinkedIn company page (if any)
 *
 * Cost: ~$0.01–0.03 per business (Claude Haiku + web search)
 * Only called when website research fails to find a name.
 */

import Anthropic from '@anthropic-ai/sdk'

export interface OwnerResearchResult {
  firstName: string | null
  lastName: string | null
  fullName: string | null
  title: string | null
  phone: string | null        // direct/mobile number if found, NOT the generic business number
  linkedinUrl: string | null
  confidence: number
  sources: string[]
  durationMs: number
  success: boolean
}

export class OwnerNameResearchAgent {
  private anthropic: Anthropic

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Anthropic API key required for OwnerNameResearchAgent')
    this.anthropic = new Anthropic({ apiKey })
  }

  async findOwnerName(
    businessName: string,
    domain: string,
    city?: string | null,
    countryCode?: string | null
  ): Promise<OwnerResearchResult> {
    const startTime = Date.now()

    const locationHint = [city, countryCode].filter(Boolean).join(', ')
    const locationStr = locationHint ? ` in ${locationHint}` : ''

    const prompt = `Find the OWNER or top decision-maker of the business "${businessName}"${locationStr} (website: ${domain}).

We need to contact the person who owns or runs this business — not a receptionist, not a generic contact form. Search for:
- "${businessName} owner" / "${businessName} eigenaar" / "${businessName} directeur" / "${businessName} zaakvoerder"
- Google Maps or TripAdvisor review responses signed by the owner or manager
- LinkedIn company page listing the owner/director
- Facebook or Instagram page bio mentioning the owner's name
- Local news or press articles about who runs the business

Return ONLY a JSON object, no markdown fences, no explanation:
{
  "firstName": "first name or null",
  "lastName": "last name or null",
  "fullName": "full name or null",
  "title": "Owner / Eigenaar / CEO / Managing Director / General Manager / Director / etc, or null",
  "phone": "direct or mobile number for this person if found, or null",
  "linkedinUrl": "full https://linkedin.com/in/... URL if found, or null",
  "confidence": 0.0,
  "sources": ["source1", "source2"]
}

Confidence guide:
- 0.9: Name found on official website or in a direct quote/byline
- 0.8: Name found in news article or review response signed by the person
- 0.7: Name found on social media page attributed to the business
- 0.5: Name inferred from context but not directly confirmed
- 0.0: No name found — return all name fields as null

Only include real human names. Do NOT include company names, job titles alone, generic text, or staff who are not the owner/top manager.`

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      })

      // Extract final text block (may follow server-side tool_use blocks)
      const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text')
      const finalText = textBlocks.map((b) => b.text).join('').trim()

      if (!finalText) {
        return this.emptyResult(startTime)
      }

      // Extract JSON object from anywhere in the text (Claude may add prose around it)
      const jsonMatch = finalText.match(/\{[\s\S]*"firstName"[\s\S]*\}/)
      if (!jsonMatch) {
        return this.emptyResult(startTime)
      }
      const parsed = JSON.parse(jsonMatch[0])

      const confidence = Math.min(parsed.confidence ?? 0, 1.0)
      const success = !!(parsed.firstName && parsed.lastName && confidence >= 0.5)

      return {
        firstName: parsed.firstName || null,
        lastName: parsed.lastName || null,
        fullName: parsed.fullName || (parsed.firstName && parsed.lastName
          ? `${parsed.firstName} ${parsed.lastName}`
          : null),
        title: parsed.title || null,
        phone: parsed.phone || null,
        linkedinUrl: parsed.linkedinUrl || null,
        confidence,
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        durationMs: Date.now() - startTime,
        success,
      }
    } catch {
      return this.emptyResult(startTime)
    }
  }

  private emptyResult(startTime: number): OwnerResearchResult {
    return {
      firstName: null,
      lastName: null,
      fullName: null,
      title: null,
      phone: null,
      linkedinUrl: null,
      confidence: 0,
      sources: [],
      durationMs: Date.now() - startTime,
      success: false,
    }
  }
}

export default OwnerNameResearchAgent
