'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, DollarSign } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface CacheHealth {
  healthy: boolean
  hitRate: number
  message: string
  recommendation?: string
}

interface CacheStats {
  totalSavings: number
  last7Days: {
    hitRate: number
    savingsUsd: number
    totalCached: number
    totalNew: number
  }
  last30Days: {
    hitRate: number
    savingsUsd: number
  }
  health: CacheHealth
}

export function CacheHealthAlert() {
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCacheStats()
    // Refresh every 5 minutes
    const interval = setInterval(fetchCacheStats, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchCacheStats = async () => {
    try {
      const response = await fetch('/api/cache/stats?view=dashboard')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching cache stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return null
  }

  if (!stats) {
    return null
  }

  const { health, last7Days, totalSavings } = stats

  return (
    <div className="space-y-3">
      {/* Cache Health Status */}
      {!health.healthy && (
        <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cache Performance Below Target</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p className="text-sm">{health.message}</p>
            {health.recommendation && (
              <p className="text-sm font-medium">{health.recommendation}</p>
            )}
            <div className="text-xs text-muted-foreground mt-2">
              Current hit rate: {health.hitRate.toFixed(1)}% | Target: &gt;80%
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Cache Performance Summary (Always Show) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Total Savings */}
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <div className="text-xs font-medium text-green-800 dark:text-green-300">
                Total Cache Savings
              </div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                ${totalSavings.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Last 7 Days Hit Rate */}
        <div className={`border rounded-lg p-4 ${
          last7Days.hitRate >= 80
            ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
            : 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
        }`}>
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-5 w-5 ${
              last7Days.hitRate >= 80
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-orange-600 dark:text-orange-400'
            }`} />
            <div>
              <div className={`text-xs font-medium ${
                last7Days.hitRate >= 80
                  ? 'text-blue-800 dark:text-blue-300'
                  : 'text-orange-800 dark:text-orange-300'
              }`}>
                7-Day Hit Rate
              </div>
              <div className={`text-2xl font-bold ${
                last7Days.hitRate >= 80
                  ? 'text-blue-900 dark:text-blue-100'
                  : 'text-orange-900 dark:text-orange-100'
              }`}>
                {last7Days.hitRate.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {last7Days.totalCached} cached / {last7Days.totalNew} new
              </div>
            </div>
          </div>
        </div>

        {/* Last 7 Days Savings */}
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <div>
              <div className="text-xs font-medium text-purple-800 dark:text-purple-300">
                7-Day Savings
              </div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                ${last7Days.savingsUsd.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                via {last7Days.totalCached} cache hits
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message (when healthy) */}
      {health.healthy && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900 dark:text-green-100">
            Cache Performance Optimal
          </AlertTitle>
          <AlertDescription className="text-green-800 dark:text-green-200">
            {health.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
