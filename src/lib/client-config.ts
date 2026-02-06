/**
 * Client Configuration Utility
 * Centralized client configuration management
 */

export interface ClientConfig {
  id: string
  name: string
  ghlApiKey?: string
  ghlLocationId?: string
  airtableApiKey?: string
  airtableBaseId?: string
  airtableTableName?: string
  customFields?: {
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
}

// Client configurations
const CLIENT_CONFIGS: Record<string, ClientConfig> = {
  'default': {
    id: 'default',
    name: 'Default Client',
    ghlApiKey: process.env.GHL_API_KEY,
    ghlLocationId: process.env.GHL_LOCATION_ID,
    airtableApiKey: process.env.AIRTABLE_API_KEY,
    airtableBaseId: process.env.AIRTABLE_BASE_ID,
    airtableTableName: process.env.AIRTABLE_TABLE_NAME || 'Leads',
    customFields: {
      companyName: process.env.GHL_FIELD_COMPANY_NAME,
      website: process.env.GHL_FIELD_WEBSITE,
      googleUrl: process.env.GHL_FIELD_GOOGLE_URL,
      nicheCategory: process.env.GHL_FIELD_NICHE_CATEGORY,
      reviewDate: process.env.GHL_FIELD_REVIEW_DATE,
      reviewStars: process.env.GHL_FIELD_REVIEW_STARS,
      qualifiedReviewsContent: process.env.GHL_FIELD_QUALIFIED_REVIEWS_CONTENT,
      qualifiedReviewUrl: process.env.GHL_FIELD_QUALIFIED_REVIEW_URL,
      googleQualifiedReviews: process.env.GHL_FIELD_GOOGLE_QUALIFIED_REVIEWS,
      reviewImageUrl: process.env.GHL_FIELD_REVIEW_IMAGE_URL,
    },
  },
}

/**
 * Get client configuration by ID
 */
export function getClientConfig(clientId: string = 'default'): ClientConfig | null {
  return CLIENT_CONFIGS[clientId] || null
}

/**
 * Get all available client IDs
 */
export function getAllClientIds(): string[] {
  return Object.keys(CLIENT_CONFIGS)
}
