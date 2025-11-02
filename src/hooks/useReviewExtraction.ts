/**
 * Custom hook for review extraction logic
 *
 * Extracts all business logic from the dashboard component into a reusable hook.
 * This significantly reduces component complexity and improves testability.
 */

import { useState, useEffect, useRef } from 'react'
import { logger } from '@/lib/logger'

// Types
interface SearchCriteria {
  [key: string]: unknown
  category: string
  location: string
  minRating?: number
  maxStars: number
  dayLimit: number
  businessLimit: number
  maxReviewsPerBusiness?: number
  language: string
  countryCode: string
}

interface ExtractionResult {
  businesses: Record<string, unknown>[]
  reviews: Record<string, unknown>[]
  searchCriteria: Record<string, unknown>
  extractionDate: Date
}

export function useReviewExtraction() {
  // Core extraction state
  const [isExtracting, setIsExtracting] = useState(false)
  const [results, setResults] = useState<ExtractionResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [lastSearchCriteria, setLastSearchCriteria] = useState<SearchCriteria | null>(null)
  const [currentExtractionId, setCurrentExtractionId] = useState<string | null>(null)

  // Contact enrichment state
  const [isEnrichingContacts, setIsEnrichingContacts] = useState(false)
  const [enrichmentProgress, setEnrichmentProgress] = useState(0)
  const [enrichmentStep, setEnrichmentStep] = useState('')

  // Request cleanup
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  /**
   * Main extraction handler
   */
  const handleExtraction = async (criteria: SearchCriteria, useOptimizedAPI = false) => {
    setIsExtracting(true)
    setProgress(0)
    setCurrentStep('Initializing extraction...')
    setLastSearchCriteria(criteria)

    const extractionStartTime = Date.now()
    const frontendRequestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController()

    const apiUrl = useOptimizedAPI ? '/api/extract-optimized' : '/api/extract'

    // Transform criteria for optimized API if needed
    const requestBody = useOptimizedAPI
      ? {
          category: criteria.category,
          location: criteria.location,
          countryCode: criteria.countryCode || 'nl',
          maxBusinessRating: criteria.minRating || 4.6,
          maxReviewStars: criteria.maxStars,
          dayLimit: criteria.dayLimit,
          businessLimit: criteria.businessLimit,
          maxReviewsPerBusiness: criteria.maxReviewsPerBusiness || 2,
          language: criteria.language || 'nl',
          useCache: true,
          forceRefresh: false
        }
      : criteria

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Frontend-Request-Id': frontendRequestId
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Stream processing
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No reader available')
      }

      let extractionResult: ExtractionResult | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const update = JSON.parse(line)

            if (update.type === 'progress') {
              setProgress(update.progress || 0)
              setCurrentStep(update.step || '')
            } else if (update.type === 'result') {
              extractionResult = update.result
              setCurrentExtractionId(update.result.extractionId || null)
            } else if (update.type === 'error') {
              throw new Error(update.error || 'Unknown error')
            }
          } catch (err) {
            logger.error('Failed to parse extraction update', { line, error: err })
          }
        }
      }

      if (extractionResult) {
        setResults(extractionResult)
        logger.info('Extraction completed successfully', {
          businesses: extractionResult.businesses?.length || 0,
          reviews: extractionResult.reviews?.length || 0,
          duration: Date.now() - extractionStartTime
        })
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.info('Extraction aborted by user')
        setCurrentStep('Extraction cancelled')
      } else {
        logger.error('Extraction failed', { error: error.message })
        setCurrentStep(`Error: ${error.message}`)
      }
    } finally {
      setIsExtracting(false)
      setProgress(100)
    }
  }

  /**
   * Abort extraction handler
   */
  const handleAbortExtraction = async () => {
    try {
      logger.info('Aborting extraction')

      // Cancel frontend request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Call backend abort API
      const response = await fetch('/api/extract', {
        method: 'DELETE'
      })

      const result = await response.json()
      logger.info('Backend extraction aborted', result)

      setIsExtracting(false)
      setProgress(0)
      setCurrentStep('Extraction aborted')

    } catch (error: any) {
      logger.error('Failed to abort extraction', { error: error.message })
    }
  }

  /**
   * Load cached reviews from database
   */
  const handleLoadCachedReviews = async () => {
    setIsExtracting(true)
    setProgress(50)
    setCurrentStep('Loading cached reviews from database...')

    try {
      const params = new URLSearchParams({
        category: lastSearchCriteria?.category || 'tandarts',
        city: lastSearchCriteria?.location || 'Amsterdam',
        maxRating: (lastSearchCriteria?.maxStars || 3).toString(),
        dayLimit: (lastSearchCriteria?.dayLimit || 14).toString(),
        limit: (lastSearchCriteria?.businessLimit || 100).toString()
      })

      const response = await fetch(`/api/database/reviews?${params}`, {
        headers: {
          'X-API-Key': 'quartziq_1236e22634e48db6b08754f0a6dd5f40dac1a28cb8067fdbf2e0faaee86ffae5'
        }
      })

      const data = await response.json()

      if (data.success && data.data) {
        const transformedResults: ExtractionResult = {
          businesses: data.data.businesses,
          reviews: data.data.reviews,
          searchCriteria: lastSearchCriteria || {},
          extractionDate: new Date()
        }

        setResults(transformedResults)
        setProgress(100)
        setCurrentStep(`Loaded ${data.data.stats.total_reviews} cached reviews`)

        logger.info('Loaded cached reviews', {
          businesses: data.data.stats.total_businesses,
          reviews: data.data.stats.total_reviews
        })
      }
    } catch (error: any) {
      logger.error('Failed to load cached reviews', { error: error.message })
    } finally {
      setTimeout(() => {
        setIsExtracting(false)
        setProgress(0)
        setCurrentStep('')
      }, 1000)
    }
  }

  /**
   * Contact enrichment handler
   */
  const handleEnrichContacts = async (businesses: any[]) => {
    setIsEnrichingContacts(true)
    setEnrichmentProgress(0)
    setEnrichmentStep('Starting contact enrichment...')

    try {
      const response = await fetch('/api/enrich-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businesses })
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No reader available')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const update = JSON.parse(line)

            if (update.type === 'progress') {
              setEnrichmentProgress(update.progress || 0)
              setEnrichmentStep(update.step || '')
            } else if (update.type === 'result') {
              // Update results with enriched businesses
              setResults(prev => prev ? {
                ...prev,
                businesses: update.enrichedBusinesses
              } : null)
            }
          } catch (err) {
            logger.error('Failed to parse enrichment update', { line, error: err })
          }
        }
      }

      logger.info('Contact enrichment completed')
    } catch (error: any) {
      logger.error('Contact enrichment failed', { error: error.message })
    } finally {
      setIsEnrichingContacts(false)
      setEnrichmentProgress(0)
      setEnrichmentStep('')
    }
  }

  return {
    // State
    isExtracting,
    results,
    progress,
    currentStep,
    lastSearchCriteria,
    currentExtractionId,
    isEnrichingContacts,
    enrichmentProgress,
    enrichmentStep,

    // Actions
    handleExtraction,
    handleAbortExtraction,
    handleLoadCachedReviews,
    handleEnrichContacts,
    setResults,
    setLastSearchCriteria
  }
}
