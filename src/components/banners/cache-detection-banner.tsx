'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Database,
  Search,
  Zap,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Sparkles
} from 'lucide-react'

interface CacheDetectionBannerProps {
  cachedCount: number
  category: string
  location: string
  costComparison: {
    searchNew: number
    useCached: number
    savings: number
    savingsPercent: number
  }
  onUseCached: () => void
  onSearchNew: () => void
  isLoading?: boolean
}

export function CacheDetectionBanner({
  cachedCount,
  category,
  location,
  costComparison,
  onUseCached,
  onSearchNew,
  isLoading = false
}: CacheDetectionBannerProps) {
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Card className="p-4 bg-muted/50 border-dashed">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Database className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                Checking cache for <span className="font-medium text-foreground">{category}</span> in <span className="font-medium text-foreground">{location}</span>...
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    )
  }

  if (cachedCount === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Card className="p-4 bg-muted/50 border-dashed">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Search className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                No cached businesses found. We'll search Google Maps for <span className="font-medium text-foreground">{category}</span> in <span className="font-medium text-foreground">{location}</span>.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              <DollarSign className="h-3 w-3 mr-1" />
              ~${costComparison.searchNew.toFixed(2)}
            </Badge>
          </div>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <Card className="p-5 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 border-green-500/20">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-green-500" />
                  {cachedCount} Businesses Already Cached!
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Found <span className="font-medium text-foreground">{cachedCount}</span> {category} businesses in {location}
                </p>
              </div>
            </div>

            {/* Cost Savings Badge */}
            <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
              <TrendingUp className="h-3 w-3 mr-1" />
              Save ${costComparison.savings.toFixed(2)} ({costComparison.savingsPercent}%)
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={onUseCached}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              <Zap className="h-4 w-4 mr-2" />
              Use Cached (Instant, $0)
            </Button>

            <Button
              onClick={onSearchNew}
              variant="outline"
              className="flex-1"
              size="lg"
            >
              <Search className="h-4 w-4 mr-2" />
              Search New (~${costComparison.searchNew.toFixed(2)})
            </Button>
          </div>

          {/* Cost Breakdown */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-green-500/20">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Cached</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                ${costComparison.useCached.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Search New</p>
              <p className="text-lg font-semibold text-muted-foreground line-through">
                ${costComparison.searchNew.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">You Save</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                ${costComparison.savings.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
