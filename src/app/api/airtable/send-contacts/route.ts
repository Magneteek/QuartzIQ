import { NextRequest, NextResponse } from 'next/server'

// Map common search terms to Airtable category values
function mapToAirtableCategory(businessName: string, searchTerm?: string): string | undefined {
  const nameAndSearch = `${businessName} ${searchTerm || ''}`.toLowerCase()

  // Dental practices
  if (nameAndSearch.includes('tandarts') || nameAndSearch.includes('dental') ||
      nameAndSearch.includes('orthodont') || nameAndSearch.includes('mondzorg')) {
    return 'Dental'
  }

  // Car dealers (matches "Car dealer" in Airtable)
  if (nameAndSearch.includes('auto') || nameAndSearch.includes('car dealer') ||
      nameAndSearch.includes('autobedrijf') || nameAndSearch.includes('garage') ||
      nameAndSearch.includes('car ')) {
    return 'Car dealer'
  }

  // Real estate (matches "Real estate agency" in Airtable)
  if (nameAndSearch.includes('makelaar') || nameAndSearch.includes('real estate') ||
      nameAndSearch.includes('vastgoed') || nameAndSearch.includes('makelaardij')) {
    return 'Real estate agency'
  }

  // Legal services (matches "Legal services" or "Lawyers" in Airtable)
  if (nameAndSearch.includes('advocat') || nameAndSearch.includes('lawyer') ||
      nameAndSearch.includes('legal') || nameAndSearch.includes('advocaten')) {
    return 'Lawyers'
  }

  // Insurance (matches "Insurance broker" or "Insurance Agency" in Airtable)
  if (nameAndSearch.includes('verzeker') || nameAndSearch.includes('insurance') ||
      nameAndSearch.includes('assurantie')) {
    return 'Insurance Agency'
  }

  // Medical & Cosmetic
  if (nameAndSearch.includes('clinic') || nameAndSearch.includes('medical') ||
      nameAndSearch.includes('cosmetic') || nameAndSearch.includes('beauty')) {
    return 'Medical & Cosmetic'
  }

  // Wellness & Lifestyle
  if (nameAndSearch.includes('wellness') || nameAndSearch.includes('spa') ||
      nameAndSearch.includes('fitness') || nameAndSearch.includes('lifestyle')) {
    return 'Wellness & Lifestyle'
  }

  // Luxury Retail
  if (nameAndSearch.includes('jewel') || nameAndSearch.includes('luxury') ||
      nameAndSearch.includes('juwel')) {
    return 'Luxury Retail & Jewelers'
  }

  // Financial & Business
  if (nameAndSearch.includes('bank') || nameAndSearch.includes('financial') ||
      nameAndSearch.includes('accountant') || nameAndSearch.includes('business')) {
    return 'Financial & Business'
  }

  return undefined // Leave blank if can't determine
}

interface Contact {
  name: string
  address: string
  phone?: string
  email?: string
  website?: string
  url?: string  // Google Maps URL
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
  // Review Information
  reviewUrl?: string
  reviewStars?: number
  reviewDate?: string
  reviewText?: string
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

    console.log('📥 Airtable API request received')
    console.log('📊 Request body keys:', Object.keys(body))
    console.log('📋 Contacts count:', contacts?.length || 0)
    console.log('🔑 Has API Key:', !!airtableApiKey)
    console.log('🆔 Has Base ID:', !!airtableBaseId)
    console.log('📁 Table Name:', airtableTableName)

    if (!contacts || contacts.length === 0) {
      console.error('❌ Error: No contacts provided')
      return NextResponse.json(
        { error: 'No contacts provided' },
        { status: 400 }
      )
    }

    if (!airtableApiKey) {
      console.error('❌ Error: Airtable API key not configured')
      return NextResponse.json(
        { error: 'Airtable API key not configured. Set AIRTABLE_API_KEY environment variable or provide in request.' },
        { status: 400 }
      )
    }

    if (!airtableBaseId) {
      console.error('❌ Error: Airtable Base ID not configured')
      return NextResponse.json(
        { error: 'Airtable Base ID not configured. Set AIRTABLE_BASE_ID environment variable or provide in request.' },
        { status: 400 }
      )
    }

    console.log(`📤 Sending ${contacts.length} contacts to Airtable (Base: ${airtableBaseId}, Table: ${airtableTableName})`)

    const results: any[] = []
    const errors: any[] = []

    // Airtable API allows batch operations, but we'll process in chunks of 10 (API limit)
    const batchSize = 10
    const batches = []
    for (let i = 0; i < contacts.length; i += batchSize) {
      batches.push(contacts.slice(i, i + batchSize))
    }

    for (const batch of batches) {
      try {
        // Prepare records for Airtable with complete field mapping
        const records = batch.map(contact => {
          const fields: Record<string, any> = {
            'Business Name': contact.name,
            'Import Status': 'Waiting for enrichment',
            'Import Date': new Date().toISOString().split('T')[0], // YYYY-MM-DD format
          }

          // Auto-detect Category from business name
          const category = mapToAirtableCategory(contact.name, contact.source)
          if (category) fields['Category'] = category

          // Owner/Contact Information
          if (contact.ownerFirstName) fields['First Name'] = contact.ownerFirstName
          if (contact.ownerLastName) fields['Last Name'] = contact.ownerLastName

          // Email - prioritize owner email, fallback to business email
          const emailToUse = contact.ownerEmail || contact.email
          if (emailToUse) fields['Email'] = emailToUse

          // Contact Details
          if (contact.phone) fields['Phone'] = contact.phone
          if (contact.website) fields['Website'] = contact.website
          if (contact.url) fields['Google Profile'] = contact.url
          if (contact.address) fields['Location'] = contact.address

          // Auto-detect Country from address
          if (contact.address) {
            const addressLower = contact.address.toLowerCase()
            if (addressLower.includes('nederland') || addressLower.includes('netherlands') || addressLower.includes('nl')) {
              fields['Country'] = 'Netherlands'
            } else if (addressLower.includes('belgi') || addressLower.includes('belgium')) {
              fields['Country'] = 'Belgium'
            }
          }

          // Review Information
          if (contact.reviewUrl) fields['Link to the negative review(s)'] = contact.reviewUrl
          if (contact.reviewStars !== undefined) fields['Stars'] = contact.reviewStars.toString()
          if (contact.reviewDate) {
            // Airtable expects ISO 8601 format (YYYY-MM-DD)
            const date = new Date(contact.reviewDate)
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            fields['Review Date'] = `${year}-${month}-${day}`
          }
          if (contact.reviewText) fields['Review Content'] = contact.reviewText

          return { fields }
        })

        console.log('📦 Sending records to Airtable:', JSON.stringify(records, null, 2))

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

        console.log('📊 Airtable API Response Status:', response.status)
        console.log('📊 Airtable API Response Data:', JSON.stringify(responseData, null, 2))

        if (response.ok && responseData.records) {
          // Airtable returns created records
          console.log('✅ Successfully created records:', responseData.records.length)
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
          console.error('❌ Airtable API Error:', responseData.error)
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
