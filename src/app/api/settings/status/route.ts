import { NextResponse } from 'next/server'

/**
 * GET /api/settings/status
 * Returns the configuration status of all API integrations
 */
export async function GET() {
  try {
    const status = {
      ghl: {
        configured: !!(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID),
        hasApiKey: !!process.env.GHL_API_KEY,
        hasLocationId: !!process.env.GHL_LOCATION_ID,
      },
      apify: {
        configured: !!process.env.APIFY_API_TOKEN,
      },
      apollo: {
        configured: !!process.env.APOLLO_API_KEY,
        monthlyLimit: parseInt(process.env.APOLLO_MONTHLY_LIMIT || '100', 10),
      },
      webhooks: {
        configured: !!(process.env.GHL_WEBHOOK_URL && process.env.GHL_WEBHOOK_SECRET),
        hasWebhookUrl: !!process.env.GHL_WEBHOOK_URL,
        hasWebhookSecret: !!process.env.GHL_WEBHOOK_SECRET,
      },
      database: {
        configured: !!(
          process.env.POSTGRES_HOST &&
          process.env.POSTGRES_DATABASE &&
          process.env.POSTGRES_USER &&
          process.env.POSTGRES_PASSWORD
        ),
      },
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error('Error checking settings status:', error)
    return NextResponse.json(
      { error: 'Failed to check settings status' },
      { status: 500 }
    )
  }
}
