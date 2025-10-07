import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🤖 AI analysis API called')
    const { searchData, businessName } = await request.json()

    if (!searchData || !businessName) {
      return NextResponse.json(
        { error: 'Search data and business name are required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Analyzing owner information for: "${businessName}"`)
    console.log(`📊 Processing ${searchData.length} characters of search data`)

    try {
      // Task tool import disabled for build stability
      console.log(`⚠️ Task tool disabled for build stability`)
      throw new Error('Task tool not available in API runtime context')

      // Parse the agent result to extract owner information
      let ownerInfo = null

      try {
        // Try to parse JSON response from agent
        const parsed = JSON.parse(agentResult)
        if (parsed.firstName || parsed.lastName || parsed.title) {
          ownerInfo = parsed
        }
      } catch (parseError) {
        // If not JSON, try to extract information from text response
        console.log(`📝 Parsing text response from agent`)
        ownerInfo = parseOwnerInfoFromText(agentResult, businessName)
      }

      if (ownerInfo) {
        console.log(`🎯 Successfully extracted owner info:`)
        console.log(`   Name: ${ownerInfo.firstName} ${ownerInfo.lastName}`)
        console.log(`   Title: ${ownerInfo.title}`)
        if (ownerInfo.email) console.log(`   Email: ${ownerInfo.email}`)

        return NextResponse.json({
          success: true,
          ownerInfo: ownerInfo,
          businessName: businessName,
          timestamp: new Date().toISOString()
        })
      } else {
        console.log(`❌ No owner information found by AI agent`)
        return NextResponse.json({
          success: false,
          message: 'No owner information found in search results',
          businessName: businessName
        })
      }

    } catch (taskError) {
      console.error('❌ Task tool failed:', taskError)

      // Fallback to pattern-based extraction
      console.log(`⚠️ Falling back to pattern-based extraction`)
      const fallbackResult = extractOwnerWithPatterns(searchData, businessName)

      return NextResponse.json({
        success: !!fallbackResult,
        ownerInfo: fallbackResult,
        fallback: true,
        businessName: businessName,
        message: fallbackResult ? 'Extracted using pattern matching' : 'No owner information found'
      })
    }

  } catch (error) {
    console.error('❌ AI analysis API error:', error)
    return NextResponse.json(
      { error: 'AI analysis failed' },
      { status: 500 }
    )
  }
}

/**
 * Parse owner information from text response
 */
function parseOwnerInfoFromText(text: string, businessName: string): {
  firstName?: string
  lastName?: string
  title?: string
  email?: string
} | null {
  try {
    // Look for common patterns in AI responses
    const namePattern = /(?:Name|Owner|CEO|Director):\s*([A-Z][a-z]+)\s+([A-Z][a-z]+)/i
    const titlePattern = /(?:Title|Position|Role):\s*([A-Z][a-z\s]+)/i
    const emailPattern = /(?:Email):\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i

    const nameMatch = text.match(namePattern)
    const titleMatch = text.match(titlePattern)
    const emailMatch = text.match(emailPattern)

    if (nameMatch) {
      return {
        firstName: nameMatch[1]?.trim(),
        lastName: nameMatch[2]?.trim(),
        title: titleMatch?.[1]?.trim(),
        email: emailMatch?.[1]?.trim()
      }
    }

    return null
  } catch (error) {
    console.log(`❌ Failed to parse owner info from text: ${error}`)
    return null
  }
}

/**
 * Fallback pattern-based extraction
 */
function extractOwnerWithPatterns(searchData: string, businessName: string): {
  firstName?: string
  lastName?: string
  title?: string
  email?: string
} | null {
  try {
    // Common owner/CEO patterns
    const patterns = [
      /CEO[:\s]+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
      /Owner[:\s]+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
      /Director[:\s]+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
      /Founder[:\s]+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
      /([A-Z][a-z]+)\s+([A-Z][a-z]+)[,\s]+(CEO|Owner|Director|Founder)/i
    ]

    for (const pattern of patterns) {
      const match = searchData.match(pattern)
      if (match) {
        const isNameFirst = match[3] // If title is in position 3, name is first
        return {
          firstName: isNameFirst ? match[1] : match[1],
          lastName: isNameFirst ? match[2] : match[2],
          title: isNameFirst ? match[3] : (match[0].includes('CEO') ? 'CEO' :
                 match[0].includes('Owner') ? 'Owner' :
                 match[0].includes('Director') ? 'Director' : 'Founder')
        }
      }
    }

    return null
  } catch (error) {
    console.log(`❌ Pattern extraction failed: ${error}`)
    return null
  }
}