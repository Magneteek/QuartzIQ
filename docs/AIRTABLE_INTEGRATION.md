# Airtable Integration Guide

## Overview

QuartzIQ now supports sending extracted leads directly to Airtable alongside the existing GoHighLevel (GHL) integration. This allows you to manage your leads in Airtable's powerful database interface.

## Features

- **Batch Processing**: Sends contacts in batches of 10 (Airtable API limit)
- **Owner Intelligence**: Includes all owner/management team data from extraction
- **Flexible Configuration**: Configure via environment variables or API request
- **Comprehensive Data**: Sends business name, address, phone, email, website, and source information
- **Error Handling**: Detailed error tracking with per-contact status reporting

## Setup Instructions

### 1. Get Your Airtable API Key

1. Go to https://airtable.com/create/tokens
2. Click "Create new token"
3. Give it a name (e.g., "QuartzIQ Integration")
4. Add the following scopes:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`
5. Add access to your specific base
6. Click "Create token" and copy the token

### 2. Find Your Base ID

1. Go to https://airtable.com/api
2. Select your base
3. The Base ID is shown in the introduction section
4. Format: `appXXXXXXXXXXXXXX`

### 3. Configure Environment Variables

Add these to your `.env.local` file:

```env
# Airtable Configuration
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=your_airtable_base_id_here
AIRTABLE_TABLE_NAME=Leads  # Optional, defaults to "Leads"
```

### 4. Create Your Airtable Table

Create a table in your Airtable base with these fields:

| Field Name | Type | Description |
|------------|------|-------------|
| Business Name | Single line text | Name of the business |
| Address | Long text | Full business address |
| Phone | Phone number | Business phone number |
| Email | Email | Business email address |
| Website | URL | Business website |
| Source | Single line text | Where the lead came from |
| Date Added | Date | When the lead was added |
| Status | Single select | Lead status (New Lead, Contacted, etc.) |
| Owner First Name | Single line text | Business owner's first name |
| Owner Last Name | Single line text | Business owner's last name |
| Owner Title | Single line text | Owner's job title |
| Owner Email | Email | Owner's email address |
| Owner Email Generated | Single select | Yes/No if email was generated |
| Management Team | Long text | JSON string of management team members |

## Usage

### From the Dashboard

1. Run a lead extraction search
2. Click "Enrich Contacts" to get email/phone/website data
3. Click "Send to CRM" button
4. Select the leads you want to send
5. Click "Send to Airtable" button
6. Leads will be added to your Airtable base

### API Usage

You can also send leads directly via API:

```bash
curl -X POST http://localhost:3000/api/airtable/send-contacts \
  -H "Content-Type: application/json" \
  -d '{
    "contacts": [
      {
        "name": "Business Name",
        "address": "123 Main St, City, Country",
        "phone": "+1234567890",
        "email": "contact@business.com",
        "website": "https://business.com",
        "source": "QuartzIQ Review Extraction",
        "ownerFirstName": "John",
        "ownerLastName": "Doe",
        "ownerTitle": "CEO",
        "ownerEmail": "john@business.com"
      }
    ]
  }'
```

### Response Format

Success response:
```json
{
  "success": true,
  "message": "Successfully sent 5 contacts to Airtable",
  "results": [
    {
      "contact": "Business Name",
      "status": "success",
      "id": "recXXXXXXXXXXXXXX",
      "message": "Contact added to Airtable successfully"
    }
  ],
  "summary": {
    "total": 5,
    "successful": 5,
    "failed": 0
  }
}
```

Error response:
```json
{
  "success": false,
  "message": "Failed to send any contacts to Airtable",
  "errors": [
    {
      "contact": "Business Name",
      "status": "error",
      "message": "Error message here"
    }
  ],
  "summary": {
    "total": 5,
    "successful": 0,
    "failed": 5
  }
}
```

## Data Mapping

QuartzIQ fields are mapped to Airtable as follows:

| QuartzIQ Field | Airtable Field | Notes |
|----------------|----------------|-------|
| title | Business Name | Required |
| address | Address | Required |
| phone | Phone | Optional |
| email | Email | Optional |
| website | Website | Optional |
| source | Source | Always "QuartzIQ Review Extraction" |
| (auto) | Date Added | Automatically set to current date/time |
| (auto) | Status | Automatically set to "New Lead" |
| ownerFirstName | Owner First Name | From owner extraction |
| ownerLastName | Owner Last Name | From owner extraction |
| ownerTitle | Owner Title | From owner extraction |
| ownerEmail | Owner Email | From owner extraction |
| ownerEmailGenerated | Owner Email Generated | Yes/No indicator |
| managementTeam | Management Team | JSON array of team members |

## Troubleshooting

### "Airtable API key not configured"
- Make sure `AIRTABLE_API_KEY` is set in your `.env.local` file
- Restart your Next.js development server after adding environment variables

### "Airtable Base ID not configured"
- Make sure `AIRTABLE_BASE_ID` is set in your `.env.local` file
- Verify the Base ID format starts with `app`

### "Failed to add contact to Airtable"
- Check that your API token has the correct scopes
- Verify the table name matches exactly (case-sensitive)
- Ensure all required fields exist in your Airtable table
- Check Airtable API status at https://status.airtable.com

### "Field not found" errors
- The field names in your Airtable table must match exactly
- Field names are case-sensitive
- If you renamed fields, update the API route code accordingly

## Advanced Configuration

### Custom Field Mapping

If you want to use different field names in your Airtable base, modify the `fields` object in `/src/app/api/airtable/send-contacts/route.ts`:

```typescript
fields: {
  'Your Custom Business Name Field': contact.name,
  'Your Custom Address Field': contact.address,
  // ... etc
}
```

### Per-Request Configuration

You can override environment variables per request:

```javascript
fetch('/api/airtable/send-contacts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contacts: [...],
    airtableApiKey: 'override_api_key',
    airtableBaseId: 'override_base_id',
    airtableTableName: 'CustomTableName'
  })
})
```

## Security Best Practices

1. **Never commit API keys**: Keep `.env.local` in `.gitignore`
2. **Use token scopes**: Only grant necessary permissions to your Airtable token
3. **Rotate tokens**: Periodically create new API tokens and revoke old ones
4. **Monitor usage**: Check Airtable's API usage dashboard regularly
5. **Limit base access**: Only give the token access to bases it needs

## Support

For issues or questions:
- Check the Airtable API documentation: https://airtable.com/developers/web/api/introduction
- Review Airtable's rate limits: https://airtable.com/developers/web/api/rate-limits
- Open an issue in the QuartzIQ repository

## What's Next?

- [ ] Add support for updating existing contacts
- [ ] Implement field mapping configuration UI
- [ ] Add Airtable webhook integration for two-way sync
- [ ] Support for attachments (business logos, etc.)
- [ ] Bulk operations and batch management
