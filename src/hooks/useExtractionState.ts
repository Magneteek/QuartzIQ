import { useState, useRef, useCallback } from 'react'

interface SearchCriteria {
  [key: string]: unknown
  category: string
  location: string
  maxRating: number
  maxStars: number
  dayLimit: number
  businessLimit: number
  minReviews: number
  minTextLength: number
  language: string
  countryCode: string
}

interface ExtractionResult {
  businesses: Record<string, unknown>[]
  reviews: Record<string, unknown>[]
  searchCriteria: Record<string, unknown>
  extractionDate: Date
}

export function useExtractionState() {
  const [isExtracting, setIsExtracting] = useState(false)
  const [results, setResults] = useState<ExtractionResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [currentExtractionId, setCurrentExtractionId] = useState<string | null>(null)
  const [lastSearchCriteria, setLastSearchCriteria] = useState<SearchCriteria | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  const handleSearch = useCallback(async (criteria: SearchCriteria) => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()

    setIsExtracting(true)
    setProgress(0)
    setCurrentStep('Initializing AI extraction engine...')
    setLastSearchCriteria(criteria)
    const extractionStartTime = Date.now()

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(criteria),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('Extraction failed')
      }

      let finalResult: ExtractionResult | null = null

      // Handle streaming response for real-time updates
      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = new TextDecoder().decode(value)
          const lines = text.split('\n').filter(line => line.trim())

          for (const line of lines) {
            try {
              const data = JSON.parse(line)
              if (data.type === 'progress') {
                setProgress(data.progress)
                setCurrentStep(data.step)
              } else if (data.type === 'result') {
                finalResult = data.result
                setResults(finalResult)
              }
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }

      // Auto-save extraction to history
      if (finalResult) {
        try {
          const extractionTime = Date.now() - extractionStartTime
          const saveResponse = await fetch('/api/history', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'save',
              data: {
                searchCriteria: criteria,
                results: finalResult,
                extractionTime
              }
            }),
          })

          if (saveResponse.ok) {
            const saveData = await saveResponse.json()
            if (saveData.success) {
              setCurrentExtractionId(saveData.data.id)
              console.log(`📚 Extraction automatically saved to vault: ${saveData.data.id}`)
            }
          }
        } catch (error) {
          console.warn('Failed to save extraction to history:', error)
        }
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setCurrentStep('Extraction cancelled')
      } else {
        console.error('Extraction error:', error)
        setCurrentStep('Extraction failed - please try again')
      }
    } finally {
      setIsExtracting(false)
      abortControllerRef.current = null
    }
  }, [])

  const cancelExtraction = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  return {
    // State
    isExtracting,
    results,
    progress,
    currentStep,
    currentExtractionId,
    lastSearchCriteria,

    // Actions
    handleSearch,
    cancelExtraction,
    setResults,
    setCurrentExtractionId,
  }
}