/**
 * Utility functions for handling review URLs
 * Ensures only valid Google Maps review URLs are displayed
 */

/**
 * Validates if a URL is a valid Google Maps review URL
 */
export function isValidGoogleReviewUrl(url: string): boolean {
  if (!url) return false

  // Check for Google Maps review URL patterns
  const googleReviewPatterns = [
    /^https:\/\/www\.google\.com\/maps\/reviews/,
    /^https:\/\/maps\.google\.com\/reviews/,
    /^https:\/\/www\.google\.com\/maps\/.*\/reviews/,
    /^https:\/\/maps\.google\.com\/.*\/reviews/
  ]

  return googleReviewPatterns.some(pattern => pattern.test(url))
}

/**
 * Validates and returns a clean review URL, or null if invalid
 */
export function getValidReviewUrl(reviewUrl: string, businessUrl?: string): string | null {
  // First check if the review URL is valid
  if (isValidGoogleReviewUrl(reviewUrl)) {
    return reviewUrl
  }

  // If review URL is invalid but we have a business URL, use that instead
  if (businessUrl && (businessUrl.includes('google.com/maps') || businessUrl.includes('maps.google.com'))) {
    return businessUrl
  }

  // No valid URL available
  return null
}

/**
 * Gets the appropriate label for the review link based on URL type
 */
export function getReviewLinkLabel(reviewUrl: string, businessUrl?: string): string {
  const validUrl = getValidReviewUrl(reviewUrl, businessUrl)

  if (!validUrl) return 'No Review Link'

  if (validUrl === reviewUrl && isValidGoogleReviewUrl(reviewUrl)) {
    return 'View Review'
  }

  if (validUrl === businessUrl) {
    return 'View Business'
  }

  return 'View on Google'
}

/**
 * Checks if review link should be displayed
 */
export function shouldShowReviewLink(reviewUrl: string, businessUrl?: string): boolean {
  return getValidReviewUrl(reviewUrl, businessUrl) !== null
}