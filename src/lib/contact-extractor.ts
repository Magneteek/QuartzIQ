/**
 * Contact Information Extractor
 * Simplified single-method approach to get phone, website, and email
 * Updated with binary content detection - v2.1
 */

import https from 'https'
import http from 'http'

interface ContactData {
  phone?: string
  website?: string
  email?: string
  socialMedia?: {
    facebook?: string
    linkedin?: string
    twitter?: string
    instagram?: string
  }
}

interface Business {
  title: string
  address: string
  totalScore: number
  reviewsCount: number
  placeId: string
  url?: string
  phone?: string
  website?: string
  email?: string
  socialMedia?: {
    facebook?: string
    linkedin?: string
    twitter?: string
    instagram?: string
  }
  contactEnriched?: boolean
  enrichmentDate?: Date
}

export class ContactExtractor {
  private apifyToken: string
  private googlePlacesApiKey?: string
  private firecrawlApiKey?: string
  private websiteScrapingActorId: string

  constructor() {
    this.apifyToken = process.env.APIFY_API_TOKEN || ''
    this.googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY
    this.firecrawlApiKey = process.env.FIRECRAWL_API_KEY
    // Use reliable website content crawler for email extraction
    this.websiteScrapingActorId = 'apify/website-content-crawler'
  }

  /**
   * Create a unique identifier for a business to detect duplicates
   */
  private createBusinessIdentifier(business: Business): string {
    // Use place ID if available (most reliable)
    if (business.placeId && !business.placeId.startsWith('extracted_from_csv_')) {
      return `placeId:${business.placeId}`
    }

    // Normalize business name for comparison
    const normalizedName = business.title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()

    // Use normalized name + address for CSV businesses
    const normalizedAddress = business.address.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()

    return `name_address:${normalizedName}|${normalizedAddress}`
  }

  /**
   * Remove duplicate businesses from the input array
   */
  private deduplicateBusinesses(businesses: Business[]): {
    uniqueBusinesses: Business[],
    duplicateStats: { originalCount: number, uniqueCount: number, duplicatesRemoved: number }
  } {
    const seen = new Map<string, Business>()
    const duplicateStats = {
      originalCount: businesses.length,
      uniqueCount: 0,
      duplicatesRemoved: 0
    }

    console.log(`🔍 Checking for duplicate businesses in ${businesses.length} entries...`)

    for (const business of businesses) {
      const identifier = this.createBusinessIdentifier(business)

      if (seen.has(identifier)) {
        console.log(`   🔄 Duplicate found: "${business.title}" (${identifier})`)
        duplicateStats.duplicatesRemoved++
      } else {
        seen.set(identifier, business)
        console.log(`   ✅ Unique business: "${business.title}" (${identifier})`)
      }
    }

    const uniqueBusinesses = Array.from(seen.values())
    duplicateStats.uniqueCount = uniqueBusinesses.length

    console.log(`📊 Deduplication complete:`)
    console.log(`   Original: ${duplicateStats.originalCount} businesses`)
    console.log(`   Unique: ${duplicateStats.uniqueCount} businesses`)
    console.log(`   Duplicates removed: ${duplicateStats.duplicatesRemoved} businesses`)

    return { uniqueBusinesses, duplicateStats }
  }

  /**
   * Check if a business already has complete contact information
   */
  private hasCompleteContactInfo(business: Business): boolean {
    // Consider complete if has phone AND email (website is often available from Google Maps)
    return !!(business.phone && business.email)
  }

  /**
   * Filter businesses to only process those that need contact enrichment
   */
  private filterBusinessesNeedingEnrichment(businesses: Business[]): {
    needsEnrichment: Business[]
    alreadyComplete: Business[]
    skippedStats: { total: number, alreadyComplete: number, needsWork: number }
  } {
    const needsEnrichment: Business[] = []
    const alreadyComplete: Business[] = []

    console.log(`🔍 Filtering businesses by contact completeness...`)

    for (const business of businesses) {
      if (this.hasCompleteContactInfo(business)) {
        alreadyComplete.push(business)
        console.log(`   ⏭️ SKIP: "${business.title}" - Already has phone (${business.phone}) and email (${business.email})`)
      } else {
        needsEnrichment.push(business)
        const missing = []
        if (!business.phone) missing.push('phone')
        if (!business.website) missing.push('website')
        if (!business.email) missing.push('email')
        console.log(`   🔄 PROCESS: "${business.title}" - Missing: ${missing.join(', ')}`)
      }
    }

    const skippedStats = {
      total: businesses.length,
      alreadyComplete: alreadyComplete.length,
      needsWork: needsEnrichment.length
    }

    console.log(`📊 Contact enrichment filtering results:`)
    console.log(`   Total businesses: ${skippedStats.total}`)
    console.log(`   Already complete: ${skippedStats.alreadyComplete} (${Math.round(skippedStats.alreadyComplete/skippedStats.total*100)}%)`)
    console.log(`   Need enrichment: ${skippedStats.needsWork} (${Math.round(skippedStats.needsWork/skippedStats.total*100)}%)`)
    console.log(`   💰 Resource savings: Skipping ${skippedStats.alreadyComplete} API calls/crawls`)

    return { needsEnrichment, alreadyComplete, skippedStats }
  }

  /**
   * Enrich businesses with complete contact information: phone, website, email
   * Single comprehensive method that gets all contact data
   */
  async enrichBusinessContacts(businesses: Business[], options: {
    maxConcurrent?: number
    fallbackMethod?: boolean
  } = {}): Promise<Business[]> {
    const { maxConcurrent = 3 } = options

    console.log(`🔍 Starting OPTIMIZED contact enrichment for ${businesses.length} businesses`)

    // Step 1: Filter out businesses that already have complete contact info
    const { needsEnrichment, alreadyComplete, skippedStats } = this.filterBusinessesNeedingEnrichment(businesses)

    if (skippedStats.alreadyComplete > 0) {
      console.log(`⚡ EFFICIENCY BOOST: Skipping ${skippedStats.alreadyComplete} businesses that already have complete contact info`)
    }

    // Step 2: Remove duplicates from businesses that need enrichment
    const { uniqueBusinesses, duplicateStats } = this.deduplicateBusinesses(needsEnrichment)

    if (duplicateStats.duplicatesRemoved > 0) {
      console.log(`⚡ Efficiency improvement: Avoiding ${duplicateStats.duplicatesRemoved} duplicate crawls`)
    }

    console.log(`📄 Unique businesses to enrich:`, uniqueBusinesses.map(b => ({
      title: b.title,
      placeId: b.placeId,
      hasWebsite: !!b.website,
      hasUrl: !!b.url
    })))

    const enrichedBusinesses: Business[] = []

    // Process unique businesses in batches
    for (let i = 0; i < uniqueBusinesses.length; i += maxConcurrent) {
      const batch = uniqueBusinesses.slice(i, i + maxConcurrent)
      const batchPromises = batch.map(async (business) => {
        try {
          let enriched = { ...business }

          // Step 1: Check what contact data we already have and fill gaps
          console.log(`   📋 Current contact data for ${business.title}:`)
          console.log(`       📞 Phone: ${business.phone ? '✅ Available' : '❌ Missing'}`)
          console.log(`       🌐 Website: ${business.website ? '✅ Available' : '❌ Missing'}`)
          console.log(`       📧 Email: ${business.email ? '✅ Available' : '❌ Missing'}`)

          // Only fetch missing phone/website data if not already available
          if (!business.phone || !business.website) {
            if (business.placeId && !business.placeId.startsWith('extracted_from_csv_')) {
              console.log(`   🏢 Getting missing contact data from Google Places API`)
              const placesData = await this.getGooglePlacesDetails(business.placeId)
              if (placesData) {
                if (!enriched.phone && placesData.phone) enriched.phone = placesData.phone
                if (!enriched.website && placesData.website) enriched.website = placesData.website
                console.log(`   ✅ Google Places: phone=${!!placesData.phone}, website=${!!placesData.website}`)
              }
            } else {
              // For CSV-imported businesses without complete contact data
              console.log(`   🌐 Getting missing contact data from Google Maps`)
              const googleMapsData = await this.getContactFromGoogleMaps(business.url || '', business.title)
              if (googleMapsData) {
                if (!enriched.phone && googleMapsData.phone) enriched.phone = googleMapsData.phone
                if (!enriched.website && googleMapsData.website) enriched.website = googleMapsData.website
                console.log(`   ✅ Google Maps extraction: phone=${!!googleMapsData.phone}, website=${!!googleMapsData.website}`)
              }
            }
          } else {
            console.log(`   ⏭️ Phone and website already available, skipping basic contact extraction`)
          }

          // Step 2: Email extraction from business website (if we have one)
          if (enriched.website && !enriched.website.includes('google.com/maps')) {
            console.log(`   📧 Extracting email from business website: ${enriched.website}`)
            const contactData = await this.scrapeWebsiteForEmail(enriched.website, business.title)
            if (contactData) {
              if (contactData.email) enriched.email = contactData.email
              if (contactData.phone && !enriched.phone) enriched.phone = contactData.phone
              console.log(`   ✅ Website contact extraction completed`)
            }
          } else {
            console.log(`   ⚠️ No business website available for ${business.title}, skipping email extraction`)
          }

          // Only mark as enriched if we actually found contact data
          const hasContactData = !!(enriched.phone || enriched.website || enriched.email)
          if (hasContactData) {
            enriched.contactEnriched = true
            enriched.enrichmentDate = new Date()
            console.log(`   ✅ Contact enrichment successful: ${business.title}`)
          } else {
            console.log(`   ⚠️ Contact enrichment attempted but no data found: ${business.title}`)
          }

          console.log(`       📞 Phone: ${enriched.phone || 'Not found'}`)
          console.log(`       🌐 Website: ${enriched.website || 'Not found'}`)
          console.log(`       📧 Email: ${enriched.email || 'Not found'}`)

          return enriched
        } catch (error: any) {
          console.log(`   ❌ Failed to enrich ${business.title}: ${error.message}`)
          return business
        }
      })

      const batchResults = await Promise.all(batchPromises)
      enrichedBusinesses.push(...batchResults)

      // Rate limiting delay between batches
      if (i + maxConcurrent < uniqueBusinesses.length) {
        console.log(`   ⏳ Rate limiting delay...`)
        await this.delay(2000)
      }
    }

    // Combine newly enriched businesses with those that were already complete
    const allBusinesses = [...alreadyComplete, ...enrichedBusinesses]

    const emailSuccessCount = allBusinesses.filter(b => b.email).length
    const phoneSuccessCount = allBusinesses.filter(b => b.phone).length
    const websiteSuccessCount = allBusinesses.filter(b => b.website).length
    const enrichedCount = allBusinesses.filter(b => b.contactEnriched).length

    console.log(`✅ OPTIMIZED contact enrichment finished!`)
    console.log(`   📊 Total businesses: ${allBusinesses.length}`)
    console.log(`   ⚡ Skipped (already complete): ${alreadyComplete.length}`)
    console.log(`   🔄 Processed: ${enrichedBusinesses.length}`)
    console.log(`   📞 Phones: ${phoneSuccessCount}/${allBusinesses.length} found (${Math.round(phoneSuccessCount/allBusinesses.length*100)}%)`)
    console.log(`   🌐 Websites: ${websiteSuccessCount}/${allBusinesses.length} found (${Math.round(websiteSuccessCount/allBusinesses.length*100)}%)`)
    console.log(`   📧 Emails: ${emailSuccessCount}/${allBusinesses.length} found (${Math.round(emailSuccessCount/allBusinesses.length*100)}%)`)
    console.log(`   💰 Resource efficiency: ${Math.round(alreadyComplete.length/businesses.length*100)}% API calls saved`)

    return allBusinesses
  }

  /**
   * Get contact details from Google Places API
   */
  private async getGooglePlacesDetails(placeId: string): Promise<ContactData | null> {
    if (!this.googlePlacesApiKey) {
      console.log('   ⚠️ Google Places API key not configured')
      return null
    }

    return new Promise((resolve, reject) => {
      const fields = 'formatted_phone_number,international_phone_number,website'
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${this.googlePlacesApiKey}`

      https.get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (parsed.status === 'OK' && parsed.result) {
              resolve({
                phone: parsed.result.formatted_phone_number || parsed.result.international_phone_number,
                website: parsed.result.website
              })
            } else {
              console.log(`   ⚠️ Google Places API status: ${parsed.status}`)
              resolve(null)
            }
          } catch (error: any) {
            reject(new Error(`Google Places API parse error: ${error.message}`))
          }
        })
      }).on('error', (error) => reject(error))
    })
  }

  /**
   * Scrape website for contact info using Firecrawl (preferred) or direct HTTP fetch (fallback)
   */
  private async scrapeWebsiteForEmail(url: string, businessName: string): Promise<ContactData | null> {
    try {
      console.log(`   📤 Extracting contact info for ${businessName}: ${url}`)

      // Try Firecrawl first for better extraction with structured data
      const firecrawlResult = await this.scrapeWithFirecrawl(url)
      if (firecrawlResult) {
        let contactData: ContactData = {}

        // Check for structured JSON data first (preferred method)
        if (firecrawlResult.extractedData) {
          console.log(`   🎯 Firecrawl AI extracted structured data:`, firecrawlResult.extractedData)
          contactData = this.processFirecrawlStructuredData(firecrawlResult.extractedData)
        }

        // Fallback to markdown/HTML content extraction if no structured data
        if (!contactData.email && firecrawlResult.content) {
          console.log(`   🔄 Falling back to content analysis from Firecrawl markdown`)
          const fallbackData = this.extractContactFromFirecrawlContent(firecrawlResult.content, firecrawlResult.metadata)
          contactData = { ...contactData, ...fallbackData }
        }

        if (contactData.email || contactData.phone) {
          console.log(`   ✅ Firecrawl extracted contact info:`)
          if (contactData.email) console.log(`     📧 Email: ${contactData.email}`)
          if (contactData.phone) console.log(`     📞 Phone: ${contactData.phone}`)
          if (contactData.website) console.log(`     🌐 Website: ${contactData.website}`)
          return contactData
        }

        // If Firecrawl AI extraction didn't find email, it likely doesn't exist or is well-hidden
        // The new schema-based approach should find emails in footers, contact sections, etc.
        if (!contactData.email) {
          console.log(`   ⚠️ Firecrawl AI schema extraction found no email - email may not be publicly available`)
        }
      }

      // Fall back to direct HTTP fetch if Firecrawl fails or finds nothing
      console.log(`   🔄 Falling back to direct HTTP fetch for ${businessName}`)
      const response = await this.fetchWebsiteContent(url)
      console.log(`   📄 Fetched ${response.length} characters of content`)

      // Show a sample of the content for debugging
      const sample = response.substring(0, 500).replace(/\s+/g, ' ').trim()
      console.log(`   📝 Content sample: ${sample}...`)

      if (response) {
        const emails = this.extractEmailsFromText(response)
        console.log(`   🔍 Found ${emails.length} potential email(s): ${emails.join(', ')}`)

        if (emails.length > 0) {
          console.log(`   ✅ Using email: ${emails[0]}`)
          return {
            email: emails[0] // Return first valid email
          }
        }
      }

      console.log(`   ❌ No contact info found in website content for ${businessName}`)
      return null
    } catch (error: any) {
      console.log(`   ❌ Website content extraction failed for ${businessName}: ${error.message}`)
      return null
    }
  }

  /**
   * Fetch website content directly using HTTPS with compression handling
   */
  private async fetchWebsiteContent(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url)
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'identity', // Don't request compression to avoid binary data
          'Connection': 'keep-alive'
        }
      }

      const protocol = urlObj.protocol === 'https:' ? https : http

      const req = protocol.request(options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log(`   🔄 Redirecting to: ${res.headers.location}`)
          return this.fetchWebsiteContent(res.headers.location).then(resolve).catch(reject)
        }

        // Check content type to ensure we're getting HTML/text
        const contentType = res.headers['content-type'] || ''
        if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
          console.log(`   ⚠️ Non-text content type: ${contentType}, skipping extraction`)
          return reject(new Error(`Invalid content type: ${contentType}`))
        }

        let rawData = Buffer.alloc(0)

        res.on('data', (chunk) => {
          rawData = Buffer.concat([rawData, chunk])
        })

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              // Convert buffer to string, handling potential encoding issues
              let data = rawData.toString('utf8')

              // Basic check to see if this looks like binary data
              const nonPrintableChars = data.replace(/[\x20-\x7E\s]/g, '').length
              const totalChars = data.length
              const binaryRatio = nonPrintableChars / totalChars

              if (binaryRatio > 0.3) {
                console.log(`   ⚠️ Content appears to be binary (${Math.round(binaryRatio * 100)}% non-printable), skipping extraction`)
                return reject(new Error('Binary content detected'))
              }

              console.log(`   ✅ Successfully fetched text content (${data.length} chars, ${Math.round(binaryRatio * 100)}% binary) - FIXED VERSION`)
              resolve(data)
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
            }
          } catch (error: any) {
            console.log(`   ❌ Error processing response: ${error.message}`)
            reject(new Error(`Response processing failed: ${error.message}`))
          }
        })
      })

      req.on('error', (error) => reject(error))
      req.setTimeout(10000, () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })
      req.end()
    })
  }

  /**
   * Run Apify actor and return run ID
   */
  private async runApifyActor(actorId: string, input: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(input)
      const options = {
        hostname: 'api.apify.com',
        port: 443,
        path: `/v2/acts/${actorId}/runs?token=${this.apifyToken}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      }

      const req = https.request(options, (res) => {
        let responseData = ''
        res.on('data', (chunk) => { responseData += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData)
            if (res.statusCode === 201) {
              resolve(parsed.data.id)
            } else {
              reject(new Error(`Apify API error: ${res.statusCode} - ${parsed.error?.message || 'Unknown error'}`))
            }
          } catch (error: any) {
            reject(new Error(`JSON parse error: ${error.message}`))
          }
        })
      })

      req.on('error', (error) => reject(error))
      req.write(data)
      req.end()
    })
  }

  /**
   * Get results from Apify run
   */
  private async getApifyResults(runId: string): Promise<any[]> {
    await this.waitForRunCompletion(runId)
    const runDetails = await this.getRunDetails(runId)
    const datasetId = runDetails.defaultDatasetId

    if (!datasetId) {
      throw new Error('No dataset ID found')
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.apify.com',
        port: 443,
        path: `/v2/datasets/${datasetId}/items?token=${this.apifyToken}`,
        method: 'GET'
      }

      https.get(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (res.statusCode === 200) {
              resolve(parsed)
            } else {
              reject(new Error(`Results error: ${res.statusCode}`))
            }
          } catch (error: any) {
            reject(new Error(`JSON parse error: ${error.message}`))
          }
        })
      }).on('error', (error) => reject(error))
    })
  }

  /**
   * Get run details from Apify
   */
  private async getRunDetails(runId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.apify.com',
        port: 443,
        path: `/v2/acts/${this.websiteScrapingActorId}/runs/${runId}?token=${this.apifyToken}`,
        method: 'GET'
      }

      https.get(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (res.statusCode === 200) {
              resolve(parsed.data)
            } else {
              reject(new Error(`Run details error: ${res.statusCode}`))
            }
          } catch (error: any) {
            reject(new Error(`JSON parse error: ${error.message}`))
          }
        })
      }).on('error', (error) => reject(error))
    })
  }

  /**
   * Wait for Apify run completion
   */
  private async waitForRunCompletion(runId: string, maxWaitTime = 60000): Promise<boolean> {
    const startTime = Date.now()
    const checkInterval = 3000

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getRunStatus(runId)
      if (status === 'SUCCEEDED') return true
      if (status === 'FAILED' || status === 'ABORTED') {
        throw new Error(`Run ${status.toLowerCase()}: ${runId}`)
      }
      await this.delay(checkInterval)
    }
    throw new Error(`Run timeout: ${runId}`)
  }

  /**
   * Get run status from Apify
   */
  private async getRunStatus(runId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.apify.com',
        port: 443,
        path: `/v2/acts/${this.websiteScrapingActorId}/runs/${runId}?token=${this.apifyToken}`,
        method: 'GET'
      }

      https.get(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            resolve(parsed.data.status)
          } catch (error) {
            reject(error)
          }
        })
      }).on('error', (error) => reject(error))
    })
  }

  /**
   * Extract emails from text content with enhanced patterns and debugging
   */
  private extractEmailsFromText(text: string): string[] {
    console.log(`   🔍 Analyzing ${text.length} characters for email addresses`)

    // Show a sample of the content for debugging
    const sample = text.substring(0, 1000).replace(/\s+/g, ' ').trim()
    console.log(`   📝 Text sample: ${sample}...`)

    // Look for specific email-related words to help debug
    const emailIndicators = ['@', 'email', 'contact', 'info', 'mail', 'mailto:']
    emailIndicators.forEach(indicator => {
      const count = (text.toLowerCase().match(new RegExp(indicator, 'g')) || []).length
      if (count > 0) {
        console.log(`   🔍 Found ${count} instances of "${indicator}"`)
      }
    })

    // Multiple email patterns to catch different formats
    const emailPatterns = [
      // Standard email pattern (most comprehensive)
      /[a-zA-Z0-9][\w\.-]*[a-zA-Z0-9]@[a-zA-Z0-9][\w\.-]*[a-zA-Z0-9]\.[a-zA-Z][a-zA-Z\.]*[a-zA-Z]/g,
      // Simpler pattern for basic emails
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      // HTML encoded emails (&#64; = @)
      /[a-zA-Z0-9._%+-]+&#64;[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      // HTML encoded emails (%40 = @)
      /[a-zA-Z0-9._%+-]+%40[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      // Obfuscated emails with [at] or (at)
      /[a-zA-Z0-9._%+-]+[\s]*\[at\][\s]*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /[a-zA-Z0-9._%+-]+[\s]*\(at\)[\s]*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      // Emails with spaces around @
      /[a-zA-Z0-9._%+-]+[\s]*@[\s]*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      // Emails in mailto links
      /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
      // JavaScript encoded emails
      /(['"])[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\1/g,
      // Emails in href attributes
      /href=['"]mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})['"/]/gi,
      // CSS-style obfuscated emails (some sites reverse email parts)
      /(\w+\.\w+)@(\w+\.\w+)/g,
      // Common business email patterns
      /info@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /contact@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /sales@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /support@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /reservations@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /booking@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      // Simple @ pattern for debugging
      /\S+@\S+\.\S+/g,
      // Pattern for emails in JSON or similar structures
      /"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"/g,
      // Pattern for emails in single quotes
      /'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'/g
    ]

    let allMatches: string[] = []

    emailPatterns.forEach((pattern, index) => {
      const matches = text.match(pattern) || []
      if (matches.length > 0) {
        console.log(`   📧 Pattern ${index + 1} found ${matches.length} matches: ${matches.slice(0, 3).join(', ')}${matches.length > 3 ? '...' : ''}`)
      }
      allMatches = allMatches.concat(matches)
    })

    // If no matches found, let's try a more aggressive approach
    if (allMatches.length === 0) {
      console.log(`   🚨 No emails found with standard patterns, trying aggressive search...`)

      // Extract all potential @ symbols and surrounding context
      const atMatches = text.match(/.{0,20}@.{0,20}/g) || []
      if (atMatches.length > 0) {
        console.log(`   🔍 Found ${atMatches.length} @ symbol contexts: ${atMatches.slice(0, 3).join(' | ')}`)
      }

      // Try to find anything that looks remotely like an email
      const superAggressivePattern = /\S*@\S*/g
      const aggressiveMatches = text.match(superAggressivePattern) || []
      if (aggressiveMatches.length > 0) {
        console.log(`   🔍 Aggressive pattern found ${aggressiveMatches.length} potential emails: ${aggressiveMatches.slice(0, 5).join(', ')}`)
        allMatches = allMatches.concat(aggressiveMatches)
      }
    }

    // Clean up and normalize emails
    const cleanedEmails = allMatches.map(email => {
      // Remove mailto: prefix
      email = email.replace(/^mailto:/i, '')
      // Remove href=" prefix and quotes
      email = email.replace(/^href=['"]mailto:/i, '').replace(/['"].*$/g, '')
      // Replace &#64; with @
      email = email.replace(/&#64;/g, '@')
      // Replace %40 with @
      email = email.replace(/%40/g, '@')
      // Replace [at] and (at) with @
      email = email.replace(/\[at\]/gi, '@')
      email = email.replace(/\(at\)/gi, '@')
      // Remove extra spaces around @
      email = email.replace(/\s*@\s*/g, '@')
      // Remove surrounding quotes
      email = email.replace(/^['"]|['"]$/g, '')
      // Convert to lowercase for consistency
      return email.toLowerCase().trim()
    })

    // Remove duplicates and filter invalid emails
    const uniqueEmails = [...new Set(cleanedEmails)]
    console.log(`   📋 Found ${uniqueEmails.length} unique email candidates: ${uniqueEmails.slice(0, 5).join(', ')}${uniqueEmails.length > 5 ? '...' : ''}`)

    const validEmails = uniqueEmails.filter(email => this.isValidBusinessEmail(email))
    console.log(`   ✅ ${validEmails.length} emails passed validation: ${validEmails.join(', ')}`)

    return validEmails.slice(0, 3) // Limit to first 3 emails
  }

  /**
   * Check if email is likely a valid business email with detailed validation
   */
  private isValidBusinessEmail(email: string): boolean {
    const lowerEmail = email.toLowerCase().trim()

    console.log(`   🧪 Validating email: ${email}`)

    // Basic format validation - more lenient
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(lowerEmail)) {
      console.log(`   ❌ Email failed basic format validation: ${email}`)
      return false
    }

    // Detect binary/garbage data by checking for high percentage of non-ASCII characters
    const nonAsciiChars = email.replace(/[\x00-\x7F]/g, '').length
    const binaryRatio = nonAsciiChars / email.length
    if (binaryRatio > 0.3) {
      console.log(`   ❌ Email appears to be binary garbage (${Math.round(binaryRatio * 100)}% non-ASCII): ${email}`)
      return false
    }

    // Invalid patterns that suggest it's not a real business email
    const invalidPatterns = [
      'example.com',
      'test.com',
      'placeholder',
      'noreply@',
      'no-reply@',
      'donotreply@',
      'mailer-daemon@',
      'postmaster@',
      'support@wordpress.org', // Common template emails
      'admin@example',
      'user@domain',
      'email@website',
      'your@email',
      'name@example'
    ]

    // Check for invalid patterns
    for (const pattern of invalidPatterns) {
      if (lowerEmail.includes(pattern)) {
        console.log(`   ❌ Email contains invalid pattern '${pattern}': ${email}`)
        return false
      }
    }

    // Additional validation for very short or suspicious emails
    if (lowerEmail.length < 5) {
      console.log(`   ❌ Email too short: ${email}`)
      return false
    }

    const [localPart, domain] = lowerEmail.split('@')
    if (!localPart || !domain || localPart.length < 1 || domain.length < 3) {
      console.log(`   ❌ Email parts too short: ${email}`)
      return false
    }

    // Check for basic domain validity
    if (!domain.includes('.')) {
      console.log(`   ❌ Domain doesn't contain a dot: ${email}`)
      return false
    }

    console.log(`   ✅ Email passed validation: ${email}`)
    return true
  }

  /**
   * Extract business website URL from Google Maps HTML content
   */
  private extractBusinessWebsiteFromMaps(htmlContent: string): string | null {
    try {
      // Look for website URL patterns in Google Maps HTML
      const websitePatterns = [
        // Common website URL patterns in Google Maps
        /data-value="(https?:\/\/[^"]+\.[a-z]{2,}[^"]*)".*?role="link"/gi,
        /href="(https?:\/\/[^"]+\.[a-z]{2,}[^"]*)".*?data-.*?website/gi,
        /"(https?:\/\/[^"]+\.[a-z]{2,}[^"]*)".*?"Website"/gi,
        // Direct website link patterns
        /website.*?"(https?:\/\/[^"]+)"/gi,
        /a href="(https?:\/\/(?!google|goog|youtube|maps)[^"]+\.[a-z]{2,}[^"]*)"[^>]*>.*?website/gi
      ]

      for (const pattern of websitePatterns) {
        const matches = htmlContent.match(pattern)
        if (matches) {
          for (const match of matches) {
            const urlMatch = pattern.exec(match)
            if (urlMatch && urlMatch[1]) {
              const url = urlMatch[1]
              // Filter out obvious non-business websites
              if (!url.includes('google.com') &&
                  !url.includes('youtube.com') &&
                  !url.includes('facebook.com/pages') &&
                  !url.includes('maps.google') &&
                  url.includes('.')) {
                console.log(`   🔍 Found potential business website: ${url}`)
                return url
              }
            }
          }
        }
      }

      // Alternative approach: look for any external links that aren't Google services
      const externalLinks = htmlContent.match(/https?:\/\/(?!google|goog|youtube|maps)[^"\s]+\.[a-z]{2,}[^"\s]*/gi)
      if (externalLinks) {
        // Filter and score potential business websites
        const businessLinks = externalLinks
          .filter(link =>
            !link.includes('facebook.com/pages') &&
            !link.includes('twitter.com') &&
            !link.includes('instagram.com') &&
            link.length < 100 // Avoid very long URLs
          )
          .slice(0, 3) // Take first few candidates

        if (businessLinks.length > 0) {
          console.log(`   🔍 Found potential business website candidates: ${businessLinks.join(', ')}`)
          return businessLinks[0] // Return the first candidate
        }
      }

      return null
    } catch (error) {
      console.log(`   ❌ Error extracting website from Google Maps content: ${error}`)
      return null
    }
  }

  /**
   * Scrape website content using Firecrawl API for better extraction
   */
  private async scrapeWithFirecrawl(url: string, retries = 3): Promise<{
    content: string
    metadata: any
    extractedData?: any
  } | null> {
    if (!this.firecrawlApiKey) {
      console.log('   ⚠️ Firecrawl API key not configured, falling back to direct fetch')
      return null
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`   🔥 Using Firecrawl to scrape: ${url} (attempt ${attempt}/${retries})`)

        const response = await fetch('https://api.firecrawl.dev/v2/extract', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.firecrawlApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            urls: [url],
            schema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  description: 'Primary contact email address found on the page (in footer, contact section, or anywhere visible)'
                },
                alternativeEmails: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Additional email addresses found on the page'
                },
                phone: {
                  type: 'string',
                  description: 'Primary phone number in any format (international, local, etc.)'
                },
                businessName: {
                  type: 'string',
                  description: 'Business or company name'
                },
                website: {
                  type: 'string',
                  description: 'Website URL or domain'
                },
                address: {
                  type: 'string',
                  description: 'Physical business address if available'
                }
              },
              required: []
            }
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.log(`   ❌ Firecrawl API error: ${response.status} ${response.statusText}`)
          console.log(`   📄 Error details: ${errorText}`)

          // Handle rate limiting (429) with exponential backoff
          if (response.status === 429) {
            const waitTime = Math.pow(2, attempt) * 1000 // Exponential backoff: 2s, 4s, 8s
            console.log(`   ⏳ Rate limited, waiting ${waitTime}ms before retry ${attempt}/${retries}`)

            if (attempt < retries) {
              await this.delay(waitTime)
              continue // Retry the request
            } else {
              console.log(`   ❌ Max retries reached for rate limiting`)
              return null
            }
          }

          // Handle server errors (5xx) with shorter backoff
          if (response.status >= 500) {
            const waitTime = 1000 * attempt // Linear backoff: 1s, 2s, 3s
            console.log(`   ⚠️ Server error ${response.status}, waiting ${waitTime}ms before retry ${attempt}/${retries}`)

            if (attempt < retries) {
              await this.delay(waitTime)
              continue // Retry the request
            } else {
              console.log(`   ❌ Max retries reached for server errors`)
              return null
            }
          }

          // For other errors (4xx), don't retry
          console.log(`   ❌ Client error ${response.status}, not retrying`)
          return null
        }

        const data = await response.json()

        if (data.success && data.data) {
          const content = data.data.markdown || data.data.html || ''
          const metadata = data.data.metadata || {}

          console.log(`   ✅ Firecrawl scraped ${content.length} characters`)
          console.log(`   📄 Page title: ${metadata.title || 'Unknown'}`)

          // Extract structured JSON data if available
          let extractedData = null
          if (data.data.extract && data.data.extract.json) {
            extractedData = data.data.extract.json
            console.log(`   🎯 Firecrawl extracted structured JSON data`)
          } else if (data.data.extract && data.data.extract.data) {
            extractedData = data.data.extract.data
            console.log(`   🎯 Firecrawl extracted data (alternative path)`)
          } else {
            console.log(`   📊 Full Firecrawl response structure:`, JSON.stringify(data.data, null, 2))
          }

          return {
            content,
            metadata,
            extractedData
          }
        } else {
          console.log(`   ❌ Firecrawl returned error: ${data.error || 'Unknown error'}`)
          // For API errors in response, don't retry immediately
          if (attempt < retries) {
            console.log(`   ⏳ Waiting 2s before next attempt due to API error`)
            await this.delay(2000)
            continue
          }
          return null
        }

      } catch (error: any) {
        console.log(`   ❌ Firecrawl request failed on attempt ${attempt}: ${error.message}`)

        // Retry on network/timeout errors
        if (attempt < retries) {
          const waitTime = 1000 * attempt // Linear backoff: 1s, 2s, 3s
          console.log(`   ⏳ Network error, waiting ${waitTime}ms before retry ${attempt}/${retries}`)
          await this.delay(waitTime)
          continue
        }

        return null
      }
    }

    // If we get here, all retries failed
    console.log(`   ❌ All Firecrawl retry attempts failed for ${url}`)
    return null
  }

  /**
   * Process structured contact data extracted by Firecrawl AI
   */
  private processFirecrawlStructuredData(extractedData: any): ContactData {
    const contactData: ContactData = {}

    try {
      console.log(`   🤖 Processing AI-extracted data:`, JSON.stringify(extractedData, null, 2))

      // Handle primary email
      if (extractedData.email && typeof extractedData.email === 'string') {
        contactData.email = extractedData.email.toLowerCase().trim()
        console.log(`   📧 AI found primary email: ${contactData.email}`)
      }

      // Handle alternative emails
      if (extractedData.alternativeEmails && Array.isArray(extractedData.alternativeEmails)) {
        const validAlternatives = extractedData.alternativeEmails
          .filter(email => typeof email === 'string' && email.includes('@'))
          .map(email => email.toLowerCase().trim())

        if (validAlternatives.length > 0 && !contactData.email) {
          contactData.email = validAlternatives[0]
          console.log(`   📧 AI found alternative email: ${contactData.email}`)
        }
      }

      // Handle phone number
      if (extractedData.phone && typeof extractedData.phone === 'string') {
        contactData.phone = extractedData.phone.trim()
        console.log(`   📞 AI found phone: ${contactData.phone}`)
      }

      // Handle business name for validation
      if (extractedData.businessName && typeof extractedData.businessName === 'string') {
        console.log(`   🏢 AI identified business: ${extractedData.businessName}`)
      }

      // Handle website URL
      if (extractedData.website && typeof extractedData.website === 'string') {
        contactData.website = extractedData.website.trim()
        console.log(`   🌐 AI found website: ${contactData.website}`)
      }

      // Handle business address
      if (extractedData.address && typeof extractedData.address === 'string') {
        console.log(`   📍 AI found address: ${extractedData.address}`)
      }

      // Handle contact page URL for future reference
      if (extractedData.contactPageUrl && typeof extractedData.contactPageUrl === 'string') {
        console.log(`   📄 AI found contact page: ${extractedData.contactPageUrl}`)
      }

      // Validate extracted email with our business email validator
      if (contactData.email && !this.isValidBusinessEmail(contactData.email)) {
        console.log(`   ⚠️ AI-extracted email failed validation, removing: ${contactData.email}`)
        delete contactData.email
      }

    } catch (error: any) {
      console.log(`   ⚠️ Error processing AI-extracted data: ${error.message}`)
    }

    return contactData
  }

  /**
   * Enhanced email extraction from Firecrawl content
   */
  private extractContactFromFirecrawlContent(content: string, metadata: any): ContactData {
    const contactData: ContactData = {}

    // Extract emails with improved patterns for Firecrawl markdown
    const emails = this.extractEmailsFromText(content)
    if (emails.length > 0) {
      contactData.email = emails[0]
    }

    // Extract phone numbers from markdown content
    const phonePatterns = [
      // International formats
      /\+\d{1,3}[\s\-\(\)]*\d{1,4}[\s\-\(\)]*\d{1,4}[\s\-\(\)]*\d{1,9}/g,
      // Dutch phone patterns
      /0\d{2,3}[\s\-]*\d{3}[\s\-]*\d{3,4}/g,
      // General phone patterns
      /\(?\d{3}\)?[\s\-]*\d{3}[\s\-]*\d{4}/g
    ]

    for (const pattern of phonePatterns) {
      const phoneMatches = content.match(pattern)
      if (phoneMatches) {
        // Clean and validate phone number
        const cleanPhone = phoneMatches[0].replace(/[^\d\+]/g, '')
        if (cleanPhone.length >= 8) {
          contactData.phone = phoneMatches[0].trim()
          break
        }
      }
    }

    // Try to extract website from metadata or content
    if (metadata.ogUrl || metadata.canonical) {
      contactData.website = metadata.ogUrl || metadata.canonical
    }

    return contactData
  }

  /**
   * Extract contact information from Google Maps using Apify
   */
  private async getContactFromGoogleMaps(mapsUrl: string, businessName: string): Promise<ContactData | null> {
    try {
      console.log(`   🗺️ Using Apify to extract contact info from Google Maps for ${businessName}`)

      // Use same input format as initial extraction
      const input = {
        searchStringsArray: [businessName],
        maxCrawledPlacesPerSearch: 1,
        language: "nl",
        countryCode: "nl",
        includeImages: false,
        includeReviews: false
      }

      // Try the reliable Google Maps scraper (same as used in initial extraction)
      const runId = await this.runApifyActor('compass~crawler-google-places', input)
      const results = await this.getApifyResults(runId)

      if (results && results.length > 0) {
        const place = results[0]
        const contactData: ContactData = {}

        // Extract phone
        if (place.phone) {
          contactData.phone = place.phone
        }

        // Extract website
        if (place.website) {
          contactData.website = place.website
        }

        // Extract email if available
        if (place.email) {
          contactData.email = place.email
        }

        console.log(`   ✅ Apify extracted: phone=${!!contactData.phone}, website=${!!contactData.website}, email=${!!contactData.email}`)
        return contactData
      } else {
        console.log(`   ⚠️ No contact data found in Apify results for ${businessName}`)
        return null
      }

    } catch (error: any) {
      console.log(`   ❌ Apify Google Maps extraction failed for ${businessName}: ${error.message}`)
      return null
    }
  }

  /**
   * Clean up binary garbage email data from business results
   * This removes emails that contain binary/garbage characters
   */
  public cleanupGarbageEmails(businesses: Business[]): Business[] {
    console.log(`🧹 Starting cleanup of binary garbage emails from ${businesses.length} businesses`)

    let cleanedCount = 0
    const cleanedBusinesses = businesses.map(business => {
      if (business.email) {
        // Use the same validation logic to detect garbage
        if (!this.isValidBusinessEmail(business.email)) {
          console.log(`   🗑️ Removing garbage email from ${business.title}: ${business.email}`)
          const cleaned = { ...business }
          delete cleaned.email
          // Reset enrichment status so it gets re-processed
          cleaned.contactEnriched = false
          delete cleaned.enrichmentDate
          cleanedCount++
          return cleaned
        }
      }
      return business
    })

    console.log(`✅ Cleanup complete: Removed ${cleanedCount} garbage emails from ${businesses.length} businesses`)
    return cleanedBusinesses
  }

  /**
   * Detect if an email contains binary garbage characters
   * This is a public method that can be used by the frontend
   */
  public isBinaryGarbageEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false

    // Check for high percentage of non-ASCII characters (same logic as validation)
    const nonAsciiChars = email.replace(/[\x00-\x7F]/g, '').length
    const binaryRatio = nonAsciiChars / email.length

    // If more than 30% non-ASCII, it's likely binary garbage
    if (binaryRatio > 0.3) {
      return true
    }

    // Additional checks for other garbage patterns
    const hasControlChars = /[\x00-\x1F\x7F-\x9F]/.test(email)
    const hasExtendedChars = /[^\x00-\x7F]/.test(email)
    const atCount = (email.match(/@/g) || []).length

    // If it has control characters, extended chars with no normal email structure, or multiple @ signs
    if (hasControlChars || (hasExtendedChars && atCount !== 1)) {
      return true
    }

    return false
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}