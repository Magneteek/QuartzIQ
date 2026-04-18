import { NextRequest, NextResponse } from 'next/server'
import { getClientConfig } from '@/lib/client-config'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

// GHL expects full country names, not ISO codes
const ISO_TO_COUNTRY: Record<string, string> = {
  AD: 'Andorra', AT: 'Austria', BE: 'Belgium', CH: 'Switzerland',
  CZ: 'Czech Republic', DE: 'Germany', DK: 'Denmark', ES: 'Spain',
  FI: 'Finland', FR: 'France', GB: 'United Kingdom', GR: 'Greece',
  HR: 'Croatia', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
  LU: 'Luxembourg', MC: 'Monaco', NL: 'Netherlands', NO: 'Norway',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', RS: 'Serbia',
  SE: 'Sweden', SI: 'Slovenia', SK: 'Slovakia', TR: 'Turkey',
  UA: 'Ukraine', US: 'United States', CA: 'Canada', AU: 'Australia',
  NZ: 'New Zealand', ZA: 'South Africa', MX: 'Mexico', BR: 'Brazil',
  AR: 'Argentina', CO: 'Colombia', CL: 'Chile', PE: 'Peru',
  JP: 'Japan', CN: 'China', KR: 'South Korea', IN: 'India',
  SG: 'Singapore', HK: 'Hong Kong', AE: 'United Arab Emirates',
}

function toCountryName(isoOrName: string): string {
  if (!isoOrName) return ''
  const upper = isoOrName.toUpperCase().trim()
  return ISO_TO_COUNTRY[upper] || isoOrName // pass through if already a full name or unknown code
}

interface Contact {
  businessId?: string
  placeId?: string
  ghlContactId?: string  // existing GHL contact ID for updates
  // Owner (contact) fields
  firstName: string
  lastName: string
  email?: string
  phone?: string
  country?: string      // ISO 3166-1 alpha-2, e.g. 'ES', 'NL'
  city?: string
  // Company fields
  companyName: string
  website?: string
  address?: string
  source: string
  customFieldsData?: {
    companyName?: string
    website?: string
    googleUrl?: string
    nicheCategory?: string
    reviewDate?: string
    reviewStars?: string
    qualifiedReviewsContent?: string
    qualifiedReviewUrl?: string
    googleQualifiedReviews?: string
    reviewImageUrl?: string
  }
  hasReviewImage?: boolean
}

interface SendContactsRequest {
  contacts: Contact[]
  clientId?: string
  // Legacy support
  apiKey?: string
  locationId?: string
}

const V2_HEADERS = (apiKey: string) => ({
  'Authorization': `Bearer ${apiKey}`,
  'Version': '2021-07-28',
  'Content-Type': 'application/json',
})

/**
 * Find or create a GHL v2 Company by name.
 * Searches first to avoid duplicates when the same company has multiple contacts.
 * Silently returns null if v2 is not available with this key.
 */
async function findOrCreateGHLCompany(
  apiKey: string,
  locationId: string,
  contact: Contact
): Promise<string | null> {
  try {
    // Search by name first
    const searchParams = new URLSearchParams({ name: contact.companyName, locationId })
    const searchRes = await fetch(
      `https://services.leadconnectorhq.com/companies/search?${searchParams}`,
      { headers: V2_HEADERS(apiKey) }
    )

    if (searchRes.ok) {
      const searchData = await searchRes.json()
      const existing = (searchData.companies || searchData.data || [])[0]
      if (existing?.id) {
        console.log(`ℹ️  GHL Company found: ${contact.companyName} → ${existing.id}`)
        return existing.id
      }
    } else if (searchRes.status === 401 || searchRes.status === 403) {
      // v2 not available — skip silently
      return null
    }

    // Not found — create
    const body: Record<string, string> = { name: contact.companyName, locationId }
    if (contact.website) body.website = contact.website
    if (contact.address) body.address1 = contact.address
    if (contact.city) body.city = contact.city
    if (contact.country) body.country = toCountryName(contact.country)

    const createRes = await fetch('https://services.leadconnectorhq.com/companies/', {
      method: 'POST',
      headers: V2_HEADERS(apiKey),
      body: JSON.stringify(body),
    })

    const createData = await createRes.json()

    if (createRes.ok) {
      const id = createData.company?.id || createData.id
      console.log(`✅ GHL Company created: ${contact.companyName} → ${id}`)
      return id
    }

    console.log(`ℹ️  GHL Company creation skipped (${createRes.status}) — companyName field only`)
    return null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SendContactsRequest = await request.json()
    const { contacts, clientId = 'default', apiKey: legacyApiKey, locationId: legacyLocationId } = body

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts provided' }, { status: 400 })
    }

    // Resolve API credentials
    let apiKey: string
    let locationId: string
    let customFields: Record<string, string> = {}

    if (legacyApiKey && legacyLocationId) {
      apiKey = legacyApiKey
      locationId = legacyLocationId
    } else {
      const clientConfig = getClientConfig(clientId)
      if (!clientConfig) {
        return NextResponse.json({ error: `Client configuration not found: ${clientId}` }, { status: 404 })
      }
      if (!clientConfig.ghlApiKey || !clientConfig.ghlLocationId) {
        return NextResponse.json({ error: `Client ${clientId} missing GHL credentials` }, { status: 400 })
      }
      apiKey = clientConfig.ghlApiKey
      locationId = clientConfig.ghlLocationId
      customFields = (clientConfig as any).customFields || {}
      console.log(`✅ Using client config: ${clientConfig.name}`)
      console.log(`🔑 API Key (first 20): ${apiKey?.substring(0, 20)}...`)
      console.log(`📍 Location ID: ${locationId}`)
    }

    const results = []
    const errors = []

    for (const contact of contacts) {
      try {
        const tags = ['QuartzIQ-Lead', 'Review-Extraction']
        if (contact.hasReviewImage) tags.push('image-content')

        // Enrichment routing tags for GHL workflow branching
        const companyEmailPrefixes = ['info', 'contact', 'office', 'admin', 'hello',
          'mail', 'reception', 'support', 'hallo', 'algemeen', 'praktijk', 'secretariat']
        const email = contact.email?.trim()
        if (!email) {
          tags.push('enrichment-phone-only')
        } else if (companyEmailPrefixes.some(p => email.toLowerCase().startsWith(p + '@'))) {
          tags.push('enrichment-company-email')
        } else {
          tags.push('enrichment-personal-email')
        }

        // Step 1: Find or create Company (dedup by name via v2; skipped if key doesn't support v2)
        const companyId = await findOrCreateGHLCompany(apiKey, locationId, contact)

        // Step 2: Build contact payload
        const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ')
        const contactData: Record<string, any> = {
          name: fullName,
          firstName: contact.firstName,
          lastName: contact.lastName,
          companyName: contact.companyName,
          locationId,
          source: contact.source,
          tags,
        }

        if (contact.email?.trim()) contactData.email = contact.email
        if (contact.phone?.trim()) contactData.phone = contact.phone
        if (contact.website?.trim()) contactData.website = contact.website
        if (contact.address?.trim()) contactData.address1 = contact.address
        if (contact.city?.trim()) contactData.city = contact.city
        if (contact.country?.trim()) contactData.country = toCountryName(contact.country)
        // Note: companyId is v2-only — v1 contacts API uses companyName string only

        // Custom fields (v1 format: object with field IDs as keys)
        if (contact.customFieldsData && Object.keys(customFields).length > 0) {
          const cf: Record<string, string> = {}
          const d = contact.customFieldsData
          const set = (key: string | undefined, val: string | undefined) => {
            if (key && val) cf[key] = val
          }
          set(customFields.companyName, d.companyName)
          set(customFields.website, d.website)
          set(customFields.googleUrl, d.googleUrl)
          set(customFields.nicheCategory, d.nicheCategory)
          set(customFields.reviewDate, d.reviewDate)
          set(customFields.reviewStars, d.reviewStars)
          set(customFields.qualifiedReviewsContent, d.qualifiedReviewsContent)
          set(customFields.qualifiedReviewUrl, d.qualifiedReviewUrl)
          set(customFields.googleQualifiedReviews, d.googleQualifiedReviews)
          set(customFields.reviewImageUrl, d.reviewImageUrl)
          if (Object.keys(cf).length > 0) contactData.customField = cf
        }

        // Step 3: Create or update contact
        // Use PUT if we have a stored GHL contact ID, but fall back to POST if 404 (deleted in GHL)
        const ghlHeaders = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

        let response: Response
        let isUpdate = false

        if (contact.ghlContactId) {
          console.log(`📤 Updating contact ${contact.ghlContactId}: ${contact.firstName} ${contact.lastName}`)
          response = await fetch(
            `https://rest.gohighlevel.com/v1/contacts/${contact.ghlContactId}`,
            { method: 'PUT', headers: ghlHeaders, body: JSON.stringify(contactData) }
          )
          if (response.status === 404 || response.status === 422) {
            // GHL returns 404 or 422 "id invalid" when contact was deleted — create fresh
            console.log(`⚠️  Contact ${contact.ghlContactId} not found in GHL (${response.status}), creating new`)
            response = await fetch(
              'https://rest.gohighlevel.com/v1/contacts/',
              { method: 'POST', headers: ghlHeaders, body: JSON.stringify(contactData) }
            )
          } else {
            isUpdate = true
          }
        } else {
          console.log(`📤 Creating contact: ${contact.firstName} ${contact.lastName} (${contact.companyName})`)
          response = await fetch(
            'https://rest.gohighlevel.com/v1/contacts/',
            { method: 'POST', headers: ghlHeaders, body: JSON.stringify(contactData) }
          )
        }

        const responseData = await response.json()
        console.log(`📨 GHL response ${response.status}:`, JSON.stringify(responseData).substring(0, 300))

        if (response.ok) {
          const ghlContactId = responseData.contact?.id || responseData.id || contact.ghlContactId

          if (contact.businessId || contact.placeId) {
            try {
              const updateQuery = contact.businessId
                ? 'UPDATE businesses SET exported_to_ghl = true, exported_to_ghl_at = NOW(), ghl_contact_id = $1 WHERE id = $2'
                : 'UPDATE businesses SET exported_to_ghl = true, exported_to_ghl_at = NOW(), ghl_contact_id = $1 WHERE place_id = $2'
              await pool.query(updateQuery, [ghlContactId, contact.businessId || contact.placeId])
              console.log(`✅ Marked ${contact.companyName} as exported`)
            } catch (dbErr) {
              console.error(`⚠️ DB update failed for ${contact.companyName}:`, dbErr)
            }
          }

          results.push({
            contact: `${contact.firstName} ${contact.lastName}`,
            company: contact.companyName,
            status: 'success',
            id: ghlContactId,
            companyId,
            message: isUpdate
              ? (companyId ? 'Company found + Contact updated' : 'Contact updated')
              : (companyId ? 'Company found/created + Contact created' : 'Contact created'),
          })
        } else {
          console.error(`❌ GHL API error for ${contact.companyName}:`, {
            status: response.status,
            response: responseData,
          })
          const ghlMessage = responseData.message || responseData.error || responseData.msg
            || JSON.stringify(responseData).substring(0, 200)
          errors.push({
            contact: `${contact.firstName} ${contact.lastName}`,
            company: contact.companyName,
            status: 'error',
            message: `GHL ${response.status}: ${ghlMessage}`,
            details: responseData,
          })
        }
      } catch (err) {
        errors.push({
          contact: `${contact.firstName} ${contact.lastName}`,
          company: contact.companyName,
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    const successCount = results.length
    const errorCount = errors.length

    if (successCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to export any contacts',
          errors,
          summary: { total: contacts.length, successful: 0, failed: errorCount },
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: errorCount === 0
        ? `Successfully exported ${successCount} contact(s) to Quartz`
        : `Partially successful: ${successCount} sent, ${errorCount} failed`,
      results,
      ...(errorCount > 0 ? { errors } : {}),
      summary: { total: contacts.length, successful: successCount, failed: errorCount },
    })
  } catch (error) {
    console.error('send-contacts error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 })
}
