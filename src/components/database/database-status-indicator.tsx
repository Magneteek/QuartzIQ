'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Database, CheckCircle2, XCircle, Loader2, TrendingUp } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DatabaseStatus {
  connected: boolean
  connection_time_ms: number | null
  database: {
    total_businesses: number
    total_categories: number
    total_cities: number
    cache_value_usd: string
  }
  top_categories: Array<{ name: string; count: number }>
  top_cities: Array<{ name: string; count: number }>
  last_checked: string
  error?: string
}

interface DatabaseStatusIndicatorProps {
  className?: string
  compact?: boolean
}

export function DatabaseStatusIndicator({
  className,
  compact = false
}: DatabaseStatusIndicatorProps) {
  const [status, setStatus] = useState<DatabaseStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)

  const checkConnection = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/database/status')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      setStatus({
        connected: false,
        connection_time_ms: null,
        database: {
          total_businesses: 0,
          total_categories: 0,
          total_cities: 0,
          cache_value_usd: '0.00'
        },
        top_categories: [],
        top_cities: [],
        last_checked: new Date().toISOString(),
        error: 'Failed to connect'
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkConnection()

    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000)

    return () => clearInterval(interval)
  }, [])

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer',
                status?.connected
                  ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                  : 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
                className
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={checkConnection}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : status?.connected ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">
                {status?.connected ? 'Connected' : 'Disconnected'}
              </span>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm">
            <div className="space-y-2">
              <div className="font-semibold flex items-center gap-2">
                <Database className="h-4 w-4" />
                Database Cache Status
              </div>
              {status?.connected ? (
                <>
                  <div className="text-sm text-muted-foreground">
                    <div>✅ Connected ({status.connection_time_ms}ms)</div>
                    <div>📊 {status.database.total_businesses.toLocaleString()} businesses</div>
                    <div>💰 ${status.database.cache_value_usd} cache value</div>
                    <div>🏷️ {status.database.total_categories} categories</div>
                    <div>🌍 {status.database.total_cities} cities</div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-red-500">
                  ❌ {status?.error || 'Connection failed'}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Click to refresh
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Card
      className={cn(
        'p-6 cursor-pointer transition-all duration-200 hover:shadow-lg',
        className
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                status?.connected ? 'bg-green-500/10' : 'bg-red-500/10'
              )}
            >
              <Database
                className={cn(
                  'h-5 w-5',
                  status?.connected ? 'text-green-500' : 'text-red-500'
                )}
              />
            </div>
            <div>
              <h3 className="font-semibold">Database Cache</h3>
              <p className="text-sm text-muted-foreground">
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Checking...
                  </span>
                ) : status?.connected ? (
                  <span className="flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected ({status.connection_time_ms}ms)
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-red-500">
                    <XCircle className="h-3 w-3" />
                    {status?.error || 'Disconnected'}
                  </span>
                )}
              </p>
            </div>
          </div>

          {status?.connected && (
            <motion.button
              className="text-sm text-primary hover:text-primary/80"
              onClick={(e) => {
                e.stopPropagation()
                checkConnection()
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Refresh
            </motion.button>
          )}
        </div>

        {/* Stats Grid */}
        {status?.connected && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Businesses</p>
              <p className="text-2xl font-bold">
                {status.database.total_businesses.toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Categories</p>
              <p className="text-2xl font-bold">
                {status.database.total_categories}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Cities</p>
              <p className="text-2xl font-bold">
                {status.database.total_cities}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Cache Value</p>
              <p className="text-2xl font-bold text-green-500">
                ${status.database.cache_value_usd}
              </p>
            </div>
          </div>
        )}

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && status?.connected && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 pt-4 border-t"
            >
              {/* Top Categories */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Top Categories</h4>
                </div>
                <div className="space-y-2">
                  {status.top_categories.map((category, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {category.name}
                      </span>
                      <span className="font-medium">
                        {category.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Cities */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Top Cities</h4>
                </div>
                <div className="space-y-2">
                  {status.top_cities.map((city, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{city.name}</span>
                      <span className="font-medium">
                        {city.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last Checked */}
              <div className="text-xs text-muted-foreground text-center">
                Last checked: {new Date(status.last_checked).toLocaleTimeString()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  )
}
