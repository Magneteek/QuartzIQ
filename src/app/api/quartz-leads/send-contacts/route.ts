import { NextRequest, NextResponse } from 'next/server'
import { getClientConfig } from '@/lib/client-config'

interface Contact {
  name: string
  address: string
  phone?: string
  email?: string
  website?: string
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
  clientId?: string // Optional - defaults to 'default'
  // Legacy support - will be deprecated
  apiKey?: string
  locationId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SendContactsRequest = await request.json()
    const { contacts, clientId = 'default', apiKey: legacyApiKey, locationId: legacyLocationId } = body

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { error: 'No contacts provided' },
        { status: 400 }
      )
    }

    // Get client configuration
    let apiKey: string
    let locationId: string
    let customFields: { [key: string]: string } = {}

    if (legacyApiKey && legacyLocationId) {
      // Legacy support - use provided API keys directly
      apiKey = legacyApiKey
      locationId = legacyLocationId
      console.log('🔄 Using legacy API key/location ID (will be deprecated)')
    } else {
      // New approach - use client configuration
      const clientConfig = getClientConfig(clientId)
      if (!clientConfig) {
        return NextResponse.json(
          { error: `Client configuration not found for: ${clientId}` },
          { status: 404 }
        )
      }

      if (!clientConfig.ghlApiKey || !clientConfig.ghlLocationId) {
        return NextResponse.json(
          { error: `Client ${clientId} is missing GHL API key or Location ID` },
          { status: 400 }
        )
      }

      apiKey = clientConfig.ghlApiKey
      locationId = clientConfig.ghlLocationId
      customFields = (clientConfig as any).customFields || {}
      console.log(`✅ Using client configuration for: ${clientConfig.name}`)
      console.log(`🔑 API Key (first 20 chars): ${apiKey?.substring(0, 20)}...`)
      console.log(`📍 Location ID: ${locationId}`)
    }

    const results = []
    const errors = []

    // Send each contact to GoHighLevel/Quartz Leads API
    for (const contact of contacts) {
      try {
        // Prepare contact data for GoHighLevel API
        const contactData: any = {
          name: contact.name,
          address1: contact.address,
          source: contact.source,
          locationId: locationId,
          // Additional fields that GoHighLevel expects
          firstName: contact.name.split(' ')[0] || contact.name,
          lastName: contact.name.split(' ').slice(1).join(' ') || '',
          tags: ['QuartzIQ-Lead', 'Review-Extraction']
        }

        // Only include email/phone/website if they have actual values (not empty strings)
        if (contact.phone && contact.phone.trim()) {
          contactData.phone = contact.phone
        }
        if (contact.email && contact.email.trim()) {
          contactData.email = contact.email
        }
        if (contact.website && contact.website.trim()) {
          contactData.website = contact.website
        }

        // Add custom field mappings from contact data
        if (contact.customFieldsData && customFields) {
          contactData.customField = contactData.customField || {}

          // Map all custom fields
          if (customFields.companyName && contact.customFieldsData.companyName) {
            contactData.customField[customFields.companyName] = contact.customFieldsData.companyName
          }
          if (customFields.website && contact.customFieldsData.website) {
            contactData.customField[customFields.website] = contact.customFieldsData.website
          }
          if (customFields.googleUrl && contact.customFieldsData.googleUrl) {
            contactData.customField[customFields.googleUrl] = contact.customFieldsData.googleUrl
          }
          if (customFields.nicheCategory && contact.customFieldsData.nicheCategory) {
            contactData.customField[customFields.nicheCategory] = contact.customFieldsData.nicheCategory
          }
          if (customFields.reviewDate && contact.customFieldsData.reviewDate) {
            contactData.customField[customFields.reviewDate] = contact.customFieldsData.reviewDate
          }
          if (customFields.reviewStars && contact.customFieldsData.reviewStars) {
            contactData.customField[customFields.reviewStars] = contact.customFieldsData.reviewStars
          }
          if (customFields.qualifiedReviewsContent && contact.customFieldsData.qualifiedReviewsContent) {
            contactData.customField[customFields.qualifiedReviewsContent] = contact.customFieldsData.qualifiedReviewsContent
          }
          if (customFields.qualifiedReviewUrl && contact.customFieldsData.qualifiedReviewUrl) {
            contactData.customField[customFields.qualifiedReviewUrl] = contact.customFieldsData.qualifiedReviewUrl
          }
          if (customFields.googleQualifiedReviews && contact.customFieldsData.googleQualifiedReviews) {
            contactData.customField[customFields.googleQualifiedReviews] = contact.customFieldsData.googleQualifiedReviews
          }
          if (customFields.reviewImageUrl && contact.customFieldsData.reviewImageUrl) {
            contactData.customField[customFields.reviewImageUrl] = contact.customFieldsData.reviewImageUrl
          }
        }

        // Add "image-content" tag if review has image
        if (contact.hasReviewImage) {
          contactData.tags.push('image-content')
        }

        // Make API call to GoHighLevel
        const response = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contactData)
        })

        const responseData = await response.json()

        if (response.ok) {
          results.push({
            contact: contact.name,
            status: 'success',
            id: responseData.contact?.id || responseData.id,
            message: 'Contact created successfully'
          })
        } else {
          console.error(`❌ GHL API Error for ${contact.name}:`, {
            status: response.status,
            statusText: response.statusText,
            response: responseData
          })
          errors.push({
            contact: contact.name,
            status: 'error',
            message: responseData.message || responseData.error || 'Failed to create contact',
            details: responseData
          })
        }
      } catch (error) {
        errors.push({
          contact: contact.name,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Return results
    const successCount = results.length
    const errorCount = errors.length

    if (errorCount === 0) {
      return NextResponse.json({
        success: true,
        message: `Successfully sent ${successCount} contacts to Quartz Leads`,
        results,
        summary: {
          total: contacts.length,
          successful: successCount,
          failed: errorCount
        }
      })
    } else if (successCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to send any contacts to Quartz Leads',
          errors,
          summary: {
            total: contacts.length,
            successful: successCount,
            failed: errorCount
          }
        },
        { status: 400 }
      )
    } else {
      return NextResponse.json({
        success: true,
        message: `Partially successful: ${successCount} sent, ${errorCount} failed`,
        results,
        errors,
        summary: {
          total: contacts.length,
          successful: successCount,
          failed: errorCount
        }
      })
    }

  } catch (error) {
    console.error('Quartz Leads API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while sending contacts to Quartz Leads',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to send contacts.' },
    { status: 405 }
  )
}