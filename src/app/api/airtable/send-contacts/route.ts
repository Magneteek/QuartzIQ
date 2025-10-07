import { NextRequest, NextResponse } from 'next/server'

interface Contact {
  name: string
  address: string
  phone?: string
  email?: string
  website?: string
  source: string
  // Owner/Management Information
  ownerFirstName?: string
  ownerLastName?: string
  ownerTitle?: string
  ownerEmail?: string
  ownerEmailGenerated?: boolean
  managementTeam?: Array<{
    firstName: string
    lastName: string
    title: string
    email?: string
  }>
}

interface SendContactsRequest {
  contacts: Contact[]
  airtableApiKey?: string
  airtableBaseId?: string
  airtableTableName?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SendContactsRequest = await request.json()
    const {
      contacts,
      airtableApiKey = process.env.AIRTABLE_API_KEY,
      airtableBaseId = process.env.AIRTABLE_BASE_ID,
      airtableTableName = process.env.AIRTABLE_TABLE_NAME || 'Leads'
    } = body

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { error: 'No contacts provided' },
        { status: 400 }
      )
    }

    if (!airtableApiKey) {
      return NextResponse.json(
        { error: 'Airtable API key not configured. Set AIRTABLE_API_KEY environment variable or provide in request.' },
        { status: 400 }
      )
    }

    if (!airtableBaseId) {
      return NextResponse.json(
        { error: 'Airtable Base ID not configured. Set AIRTABLE_BASE_ID environment variable or provide in request.' },
        { status: 400 }
      )
    }

    console.log(`📤 Sending ${contacts.length} contacts to Airtable (Base: ${airtableBaseId}, Table: ${airtableTableName})`)

    const results = []
    const errors = []

    // Airtable API allows batch operations, but we'll process in chunks of 10 (API limit)
    const batchSize = 10
    const batches = []
    for (let i = 0; i < contacts.length; i += batchSize) {
      batches.push(contacts.slice(i, i + batchSize))
    }

    for (const batch of batches) {
      try {
        // Prepare records for Airtable
        const records = batch.map(contact => ({
          fields: {
            'Business Name': contact.name,
            'Address': contact.address || '',
            'Phone': contact.phone || '',
            'Email': contact.email || '',
            'Website': contact.website || '',
            'Source': contact.source,
            'Date Added': new Date().toISOString(),
            'Status': 'New Lead',
            // Owner Information (if available)
            'Owner First Name': contact.ownerFirstName || '',
            'Owner Last Name': contact.ownerLastName || '',
            'Owner Title': contact.ownerTitle || '',
            'Owner Email': contact.ownerEmail || '',
            'Owner Email Generated': contact.ownerEmailGenerated ? 'Yes' : 'No',
            // Management Team (as JSON string for now)
            'Management Team': contact.managementTeam && contact.managementTeam.length > 0
              ? JSON.stringify(contact.managementTeam)
              : ''
          }
        }))

        // Make API call to Airtable
        const response = await fetch(
          `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(airtableTableName)}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${airtableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ records })
          }
        )

        const responseData = await response.json()

        if (response.ok && responseData.records) {
          // Airtable returns created records
          responseData.records.forEach((record: any, index: number) => {
            results.push({
              contact: batch[index].name,
              status: 'success',
              id: record.id,
              message: 'Contact added to Airtable successfully'
            })
          })
        } else {
          // Handle errors
          batch.forEach(contact => {
            errors.push({
              contact: contact.name,
              status: 'error',
              message: responseData.error?.message || 'Failed to add contact to Airtable'
            })
          })
        }
      } catch (error) {
        // Batch-level error
        batch.forEach(contact => {
          errors.push({
            contact: contact.name,
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
          })
        })
      }
    }

    // Return results
    const successCount = results.length
    const errorCount = errors.length

    console.log(`✅ Airtable sync complete: ${successCount} successful, ${errorCount} failed`)

    if (errorCount === 0) {
      return NextResponse.json({
        success: true,
        message: `Successfully sent ${successCount} contacts to Airtable`,
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
          message: 'Failed to send any contacts to Airtable',
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
    console.error('Airtable API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while sending contacts to Airtable',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Method not allowed. Use POST to send contacts to Airtable.',
      example: {
        method: 'POST',
        body: {
          contacts: [{
            name: 'Business Name',
            address: '123 Main St',
            phone: '+1234567890',
            email: 'contact@business.com',
            website: 'https://business.com',
            source: 'QuartzIQ Review Extraction'
          }],
          airtableApiKey: 'your_api_key_here (optional if env var set)',
          airtableBaseId: 'your_base_id_here (optional if env var set)',
          airtableTableName: 'Leads (optional, defaults to "Leads")'
        }
      }
    },
    { status: 405 }
  )
}
