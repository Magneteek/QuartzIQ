import { useState, useEffect, useCallback } from 'react'

interface CacheDetectionResult {
  hasCached: boolean
  cachedCount: number
  sampleBusinesses: any[]
  costComparison: {
    searchNew: number
    useCached: number
    savings: number
    savingsPercent: number
  }
  recommendation: 'cached' | 'search'
}

export function useCacheDetection(category: string | undefined, location: string | undefined) {
  const [cacheData, setCacheData] = useState<CacheDetectionResult | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkCache = useCallback(async () => {
    if (!category || !location) {
      setCacheData(null)
      return
    }

    setIsChecking(true)
    setError(null)

    try {
      const response = await fetch('/api/check-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category, location }),
      })

      if (!response.ok) {
        throw new Error('Failed to check cache')
      }

      const data = await response.json()
      setCacheData(data)
    } catch (err: any) {
      console.error('Cache check error:', err)
      setError(err.message)
      setCacheData(null)
    } finally {
      setIsChecking(false)
    }
  }, [category, location])

  useEffect(() => {
    // Debounce cache check - wait 500ms after user stops typing
    const timer = setTimeout(() => {
      checkCache()
    }, 500)

    return () => clearTimeout(timer)
  }, [checkCache])

  return {
    cacheData,
    isChecking,
    error,
    recheckCache: checkCache,
  }
}
