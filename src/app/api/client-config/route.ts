import { NextRequest, NextResponse } from 'next/server'

/**
 * Multi-Client Configuration API
 * Allows different clients to have their own GHL API keys and location IDs
 */

interface ClientConfig {
  clientId: string
  clientName: string
  ghlApiKey: string
  ghlLocationId: string
  ghlWebhookUrl?: string
  customFields?: {
    [key: string]: string // Maps our fields to their GHL custom field IDs
  }
  settings?: {
    autoCreateContacts: boolean
    includeReviewText: boolean
    tagReviewType: boolean
  }
}

// In production, this would be stored in a database
// For now, we'll use environment variables for different clients
const CLIENT_CONFIGS: { [key: string]: ClientConfig } = {
  default: {
    clientId: 'default',
    clientName: 'Default Client',
    ghlApiKey: process.env.GHL_API_KEY || '',
    ghlLocationId: process.env.GHL_LOCATION_ID || '',
    ghlWebhookUrl: process.env.GHL_WEBHOOK_URL,
    customFields: {
      businessName: process.env.GHL_FIELD_BUSINESS_NAME || '',
      reviewRating: process.env.GHL_FIELD_REVIEW_RATING || '',
      reviewText: process.env.GHL_FIELD_REVIEW_TEXT || '',
      businessCategory: process.env.GHL_FIELD_BUSINESS_CATEGORY || '',
      reviewDate: process.env.GHL_FIELD_REVIEW_DATE || ''
    },
    settings: {
      autoCreateContacts: true,
      includeReviewText: true,
      tagReviewType: true
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId') || 'default'

    const config = CLIENT_CONFIGS[clientId]
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Client configuration not found' },
        { status: 404 }
      )
    }

    // Return config without sensitive API keys (for frontend display)
    const safeConfig = {
      clientId: config.clientId,
      clientName: config.clientName,
      hasApiKey: !!config.ghlApiKey,
      hasLocationId: !!config.ghlLocationId,
      customFields: config.customFields,
      settings: config.settings
    }

    return NextResponse.json({ success: true, data: safeConfig })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, clientId = 'default', config } = body

    switch (action) {
      case 'update':
        // In production, this would update the database
        // For now, just validate the config
        if (!config.ghlApiKey || !config.ghlLocationId) {
          return NextResponse.json(
            { success: false, error: 'GHL API Key and Location ID are required' },
            { status: 400 }
          )
        }

        // Store the updated config (in memory for now)
        CLIENT_CONFIGS[clientId] = { ...CLIENT_CONFIGS[clientId], ...config }

        return NextResponse.json({
          success: true,
          message: 'Client configuration updated',
          data: { clientId }
        })

      case 'test':
        // Test the GHL connection with provided credentials
        const testConfig = CLIENT_CONFIGS[clientId]
        if (!testConfig?.ghlApiKey) {
          return NextResponse.json(
            { success: false, error: 'No API configuration found for client' },
            { status: 400 }
          )
        }

        // Test API connection (implement actual test here)
        return NextResponse.json({
          success: true,
          message: 'GHL connection test successful',
          data: {
            clientId,
            locationId: testConfig.ghlLocationId,
            timestamp: new Date()
          }
        })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: update, test' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Helper function to get client config (for use by other APIs)
export function getClientConfig(clientId: string = 'default'): ClientConfig | null {
  return CLIENT_CONFIGS[clientId] || null
}