import { NextRequest, NextResponse } from 'next/server'
import { requireRoleAPI } from '@/lib/auth-helpers'
import { ApifyClient } from 'apify-client'

/**
 * Extract place_id and fetch business details from Google Maps URL
 * Uses Apify for reliable data extraction
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = await requireRoleAPI(['admin', 'va'])
    if (error) return error

    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'Google Maps URL is required' },
        { status: 400 }
      )
    }

    // Validate and clean URL
    let cleanUrl = url.trim()

    // Check if it's a valid Google Maps URL
    if (!cleanUrl.includes('google.com/maps') && !cleanUrl.includes('maps.app.goo.gl')) {
      return NextResponse.json(
        { error: 'Invalid Google Maps URL. Must be from google.com/maps or maps.app.goo.gl' },
        { status: 400 }
      )
    }

    // Remove unnecessary query parameters that might confuse Apify
    try {
      const urlObj = new URL(cleanUrl)
      // Keep only essential parameters
      const essentialParams = ['place_id', 'cid', 'ftid']
      const newParams = new URLSearchParams()

      essentialParams.forEach(param => {
        if (urlObj.searchParams.has(param)) {
          newParams.set(param, urlObj.searchParams.get(param)!)
        }
      })

      // Rebuild URL with clean parameters
      urlObj.search = newParams.toString()
      cleanUrl = urlObj.toString()
    } catch (e) {
      // If URL parsing fails, use original URL
      console.log('[Google Maps Extract] Could not parse URL, using original')
    }

    // Initialize Apify client
    const apifyToken = process.env.APIFY_API_TOKEN
    if (!apifyToken) {
      return NextResponse.json(
        { error: 'Apify API token not configured' },
        { status: 500 }
      )
    }

    const client = new ApifyClient({ token: apifyToken })

    console.log('[Google Maps Extract] Original URL:', url)
    console.log('[Google Maps Extract] Cleaned URL for Apify:', cleanUrl)

    // Run Apify actor to scrape business details
    // Apify expects startUrls as array of objects with 'url' property
    const actorInput = {
      startUrls: [{ url: cleanUrl }],
      maxCrawledPlaces: 1,
      language: 'en',
      includeWebResults: false,
    }

    console.log('[Google Maps Extract] Starting Apify actor with input:', JSON.stringify(actorInput, null, 2))

    const run = await client.actor('compass/crawler-google-places').call(actorInput)

    console.log('[Google Maps Extract] Apify run completed:', run.id)

    // Get results from dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    if (!items || items.length === 0) {
      // Fallback: Extract business name from URL
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/')
      const placeIndex = pathParts.indexOf('place')
      const businessNameFromUrl = placeIndex !== -1 && pathParts[placeIndex + 1]
        ? decodeURIComponent(pathParts[placeIndex + 1].replace(/\+/g, ' '))
        : ''

      if (businessNameFromUrl) {
        console.log('[Google Maps Extract] No results from Apify, using URL data')
        return NextResponse.json({
          success: true,
          details: {
            business_name: businessNameFromUrl,
            google_profile_url: url,
          },
          note: 'Limited data - Apify found no results'
        })
      }

      return NextResponse.json(
        { error: 'Could not extract business data from URL' },
        { status: 400 }
      )
    }

    const business = items[0] as any

    console.log('[Google Maps Extract] Business found:', business.title)

    // Parse address
    const address = business.address || business.location?.address || ''
    const city = business.city || business.location?.city || ''
    const country = business.country || business.location?.country || ''

    // Extract business details from Apify result
    const businessDetails = {
      business_name: business.title || business.name || '',
      place_id: business.placeId || business.place_id || '',
      address: address,
      city: city,
      country: country,
      phone: business.phoneNumber || business.phone || '',
      website: business.website || business.url || '',
      rating: business.totalScore || business.rating || null,
      total_reviews: business.reviewsCount || business.reviews || null,
      category: business.categoryName || business.category || '',
      google_profile_url: url,
      google_maps_url: url, // Populate both for review crawling compatibility
      latitude: business.location?.lat || null,
      longitude: business.location?.lng || null,
    }

    console.log('[Google Maps Extract] Extracted:', {
      name: businessDetails.business_name,
      rating: businessDetails.rating,
      reviews: businessDetails.total_reviews,
    })

    return NextResponse.json({
      success: true,
      details: businessDetails,
    })
  } catch (error: any) {
    console.error('[Google Maps Extract] Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to extract business details: ' + error.message },
      { status: 500 }
    )
  }
}

