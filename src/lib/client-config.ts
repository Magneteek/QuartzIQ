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
