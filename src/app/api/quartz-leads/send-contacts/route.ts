import { NextRequest, NextResponse } from 'next/server'
import { getClientConfig } from '../../client-config/route'

interface Contact {
  name: string
  address: string
  phone?: string
  email?: string
  website?: string
  source: string
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
      customFields = clientConfig.customFields || {}
      console.log(`✅ Using client configuration for: ${clientConfig.clientName}`)
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
          phone: contact.phone || '',
          email: contact.email || '',
          website: contact.website || '',
          source: contact.source,
          locationId: locationId,
          // Additional fields that GoHighLevel expects
          firstName: contact.name.split(' ')[0] || contact.name,
          lastName: contact.name.split(' ').slice(1).join(' ') || '',
          tags: ['QuartzIQ-Lead', 'Review-Extraction']
        }

        // Add custom field mappings if configured
        if (customFields.businessName && contact.name) {
          contactData.customFields = contactData.customFields || {}
          contactData.customFields[customFields.businessName] = contact.name
        }
        if (customFields.businessCategory && contact.source) {
          contactData.customFields = contactData.customFields || {}
          contactData.customFields[customFields.businessCategory] = contact.source
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
          errors.push({
            contact: contact.name,
            status: 'error',
            message: responseData.message || responseData.error || 'Failed to create contact'
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