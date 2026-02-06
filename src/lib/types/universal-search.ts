/**
 * Universal Search System Types
 * Flexible search parameters for multiple use cases:
 * - Lead generation
 * - Review analysis
 * - Market research
 * - Competitive analysis
 * - Review momentum tracking
 */

export interface UniversalSearchCriteria {
  // ========================================
  // CORE SEARCH (Required)
  // ========================================
  category: string;              // "dentist", "restaurant", "hotel"
  location: string;              // "Madrid", "Spain", "Barcelona"
  countryCode?: string;          // "es", "nl", "de" (auto-detected from location)
  language?: string;             // "en", "es", "nl" (auto-detected)
  useCached?: boolean;           // ✅ Skip Google Maps, use cached businesses only

  // ========================================
  // BUSINESS FILTERS (Optional - flexible)
  // ========================================
  businessFilters?: {
    // Rating filters
    minRating?: number;          // e.g., 4.0 (quality businesses)
    maxRating?: number;          // e.g., 3.5 (struggling businesses)

    // Review count filters (business size/popularity)
    minReviewCount?: number;     // e.g., 100 (established businesses)
    maxReviewCount?: number;     // e.g., 50 (smaller/newer businesses)

    // Activity filters
    reviewMomentum?: {
      enabled: boolean;
      period: number;            // Days to analyze (e.g., 30, 90)
      minReviewsInPeriod: number; // e.g., 10 reviews in last 30 days
      type: 'growing' | 'declining' | 'stable' | 'spike' | 'any';
    };

    // Business status
    status?: 'active' | 'temporarily_closed' | 'permanently_closed' | 'any';
    mustHaveWebsite?: boolean;   // Only businesses with websites
    mustHavePhone?: boolean;      // Only businesses with phone numbers

    // Search options
    multiLanguageSearch?: boolean; // Search in both local + English (default: false)

    // Geographic refinement
    radius?: number;             // Search radius in km (for precise areas)
    excludeCities?: string[];    // Exclude specific cities
  };

  // ========================================
  // REVIEW FILTERS (Optional - only if analyzing reviews)
  // ========================================
  reviewFilters?: {
    enabled: boolean;            // Set to false to skip review extraction

    // Review quality filters
    minStars?: number;           // e.g., 1 (very negative)
    maxStars?: number;           // e.g., 3 (negative to neutral)

    // Review timing
    dayLimit?: number;           // Reviews from last X days
    dateRange?: {
      from: Date;
      to: Date;
    };

    // Review content filters
    minTextLength?: number;      // Only reviews with substantial text
    language?: string;           // Filter by review language
    mustHaveOwnerResponse?: boolean; // Only reviews with owner replies
    mustHavePhotos?: boolean;    // ✅ Only reviews with attached photos/images
    minPhotos?: number;          // Minimum number of photos (default: 1)

    // Review velocity (momentum)
    velocityFilter?: {
      enabled: boolean;
      period: number;            // Days to analyze
      minReviews: number;        // Min reviews in period
      trendType: 'increasing' | 'decreasing' | 'spike' | 'any';
    };
  };

  // ========================================
  // EXTRACTION LIMITS (Performance control)
  // ========================================
  limits?: {
    maxBusinesses?: number;      // Total businesses to find (default: 50)
    maxReviewsPerBusiness?: number; // Max reviews to extract per business (default: 5)
    maxTotalReviews?: number;    // Global review limit across all businesses
  };

  // ========================================
  // ENRICHMENT OPTIONS (What contact data to get)
  // ========================================
  enrichment?: {
    enabled: boolean;            // Enable/disable enrichment

    // Basic enrichment (Apify built-in - $0.005/business)
    apifyEnrichment?: {
      enabled: boolean;
      scrapeWebsite: boolean;    // Get emails from website
      scrapeSocialMedia: boolean; // Get social media links
      maxPagesPerSite: number;   // Website crawl depth (1-5)
    };

    // Premium enrichment (Apollo - $0.40-1.80/business)
    apolloEnrichment?: {
      enabled: boolean;
      targetExecutives: boolean;  // Find owner/CEO/management
      departments?: string[];     // e.g., ['C-Suite', 'Marketing', 'Operations']
      maxContactsPerBusiness: number; // Limit Apollo credits
      onlyForTopRated?: boolean;  // Only enrich businesses with rating >= X
    };

    // Smart tiered enrichment
    tieredStrategy?: {
      enabled: boolean;
      tier1Count: number;        // Top N businesses get Apollo enrichment
      tier1Criteria: {
        minRating?: number;      // e.g., 4.5
        minReviews?: number;     // e.g., 100
      };
    };
  };

  // ========================================
  // OUTPUT PREFERENCES (What data to return)
  // ========================================
  output?: {
    includeReviews: boolean;     // Return reviews or just businesses?
    includeRawData: boolean;     // Include full Apify JSON response
    format: 'full' | 'minimal' | 'contacts-only';

    // Field selection (reduce payload size)
    businessFields?: string[];   // e.g., ['name', 'phone', 'email', 'rating']
    reviewFields?: string[];     // e.g., ['text', 'stars', 'publishedAtDate']
  };

  // ========================================
  // CACHE & PERFORMANCE
  // ========================================
  cache?: {
    useCache: boolean;           // Use cached businesses (default: true)
    forceRefresh: boolean;       // Ignore cache, fetch fresh (default: false)
    cacheEnrichment: boolean;    // Store enrichment data (default: true)
  };
}

/**
 * Legacy search criteria (for backward compatibility)
 */
export interface LegacySearchCriteria {
  category: string;
  location: string;
  minRating?: number;
  maxReviewsPerBusiness?: number;
  maxStars?: number;
  dayLimit?: number;
  businessLimit?: number;
  language?: string;
  maxQueries?: number;
  resultsPerQuery?: number;
  countryCode?: string;
  placeIds?: string;
  excludePlaceIds?: string[];
  useCached?: boolean;
}

/**
 * Review momentum data
 */
export interface ReviewMomentumData {
  businessId: string;
  businessName: string;
  totalReviews: number;

  // Momentum metrics
  reviewsInPeriod: number;
  reviewVelocity: number;        // Reviews per day
  trend: 'increasing' | 'decreasing' | 'stable' | 'spike';

  // Period comparison
  currentPeriodReviews: number;
  previousPeriodReviews: number;
  percentChange: number;

  // Quality momentum
  avgRatingInPeriod: number;
  ratingTrend: 'improving' | 'declining' | 'stable';
}

/**
 * Extended business with momentum data
 */
export interface BusinessWithMomentum {
  // Standard business fields
  id?: string;
  title: string;
  address: string;
  category?: string;
  city?: string;
  totalScore: number;
  reviewsCount: number;
  placeId: string;
  url?: string;

  // Contact information
  phone?: string;
  website?: string;
  email?: string;

  // Enriched contact data
  emailEnriched?: string;
  emailSource?: string;
  emailConfidence?: string;

  // Owner/Executive data
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerEmail?: string;
  ownerTitle?: string;
  ownerLinkedin?: string;

  // Social media
  socialMedia?: {
    facebook?: string;
    linkedin?: string;
    twitter?: string;
    instagram?: string;
  };

  // Enrichment metadata
  contactEnriched?: boolean;
  enrichmentDate?: Date;
  lastEnrichedAt?: Date;
  enrichmentProvider?: string;
  enrichmentCostUsd?: number;

  // Momentum data (if requested)
  momentum?: ReviewMomentumData;
}

/**
 * Universal search response
 */
export interface UniversalSearchResponse {
  success: boolean;

  // Results
  businesses: BusinessWithMomentum[];
  reviews?: any[];

  // Search metadata
  searchCriteria: UniversalSearchCriteria;
  extractionDate: Date;

  // Statistics
  stats: {
    totalBusinesses: number;
    totalReviews: number;
    cachedBusinesses: number;
    newBusinesses: number;
    enrichedBusinesses: number;

    // Cost tracking
    apifyCostUsd: number;
    apolloCostUsd: number;
    totalCostUsd: number;

    // Cache performance
    cacheHitRate: number;
    savingsUsd: number;
  };

  // Momentum stats (if momentum filter was used)
  momentumStats?: {
    businessesAnalyzed: number;
    businessesMatchingCriteria: number;
    avgReviewVelocity: number;
    trendDistribution: {
      increasing: number;
      decreasing: number;
      stable: number;
      spike: number;
    };
  };
}

/**
 * Convert legacy search criteria to universal format
 */
export function convertLegacyToUniversal(
  legacy: LegacySearchCriteria
): UniversalSearchCriteria {
  return {
    category: legacy.category,
    location: legacy.location,
    countryCode: legacy.countryCode,
    language: legacy.language,

    businessFilters: {
      minRating: legacy.minRating,
    },

    reviewFilters: {
      enabled: true, // Legacy always extracted reviews
      maxStars: legacy.maxStars,
      dayLimit: legacy.dayLimit,
    },

    limits: {
      maxBusinesses: legacy.businessLimit || 50,
      maxReviewsPerBusiness: legacy.maxReviewsPerBusiness || 5,
    },

    enrichment: {
      enabled: false, // Legacy didn't have enrichment by default
    },

    output: {
      includeReviews: true,
      includeRawData: false,
      format: 'full',
    },

    cache: {
      useCache: legacy.useCached !== false,
      forceRefresh: false,
      cacheEnrichment: true,
    },
  };
}
