'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  RefreshCw,
  Star,
  TrendingUp,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface CrawlHistoryDetail {
  id: string
  crawledAt: string
  durationSeconds: number | null
  reviewsFound: number
  reviewsNew: number
  reviewsDuplicate: number
  isIncremental: boolean
  costUsd: number
  status: string
  nextRecommendedCrawl: string | null
}

interface BusinessHistorySummary {
  businessId: string
  businessName: string
  totalCrawls: number
  totalReviewsFound: number
  totalReviewsNew: number
  totalCostUsd: number
  incrementalCrawls: number
  avgReviewsPerCrawl: number
}

export default function BusinessCrawlHistoryPage({
  params
}: {
  params: Promise<{ businessId: string }>
}) {
  const [history, setHistory] = useState<CrawlHistoryDetail[]>([])
  const [summary, setSummary] = useState<BusinessHistorySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [businessId, setBusinessId] = useState<string>('')

  useEffect(() => {
    params.then(p => {
      setBusinessId(p.businessId)
      loadBusinessHistory(p.businessId)
    })
  }, [params])

  const loadBusinessHistory = async (id: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/crawl/businesses/${id}/history`)
      const data = await response.json()

      if (data.success) {
        setHistory(data.history || [])
        setSummary(data.totals ? {
          businessId: data.businessId,
          businessName: 'Business Name', // TODO: Get from API
          totalCrawls: data.totals.totalCrawls,
          totalReviewsFound: data.totals.totalReviewsFound,
          totalReviewsNew: data.totals.totalReviewsNew,
          totalCostUsd: data.totals.totalCostUsd,
          incrementalCrawls: data.totals.incrementalCrawls,
          avgReviewsPerCrawl: data.totals.avgReviewsPerCrawl
        } : null)
      }
    } catch (error) {
      console.error('Failed to load business history:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-card p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/crawl-history">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to History
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                {summary?.businessName || 'Business Crawl History'}
              </h1>
              <p className="text-muted-foreground mt-1">
                Complete crawl history for this business
              </p>
            </div>
          </div>
          <Button
            onClick={loadBusinessHistory}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Summary Statistics */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-600/10 border-blue-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Crawls</p>
                  <p className="text-2xl font-bold text-blue-300">{summary.totalCrawls}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.incrementalCrawls} incremental
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-blue-400" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-600/10 border-green-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Reviews Found</p>
                  <p className="text-2xl font-bold text-green-300">{summary.totalReviewsFound}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.totalReviewsNew} new
                  </p>
                </div>
                <Star className="h-8 w-8 text-green-400" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-600/10 border-yellow-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold text-yellow-300">
                    ${summary.totalCostUsd.toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${(summary.totalCostUsd / summary.totalCrawls).toFixed(4)}/crawl
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-400" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-600/10 border-purple-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Reviews</p>
                  <p className="text-2xl font-bold text-purple-300">
                    {summary.avgReviewsPerCrawl.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">per crawl</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-400" />
              </div>
            </Card>
          </div>
        )}
      </motion.div>

      {/* Crawl Timeline */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Crawl Timeline
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : history.length > 0 ? (
          <div className="space-y-4">
            {history.map((record, index) => (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative pl-8 pb-8 border-l-2 border-border last:pb-0"
              >
                {/* Timeline Dot */}
                <div className="absolute left-0 top-0 -translate-x-1/2">
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 border-background',
                    record.status === 'completed'
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  )} />
                </div>

                {/* Crawl Details */}
                <Card className="p-4 bg-white/5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(record.crawledAt)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {record.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                        <span className="text-xs font-medium">
                          {record.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      record.isIncremental
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                    )}>
                      {record.isIncremental ? 'Incremental' : 'Full Crawl'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Reviews Found</p>
                      <p className="text-lg font-bold">{record.reviewsFound}</p>
                      {record.reviewsNew > 0 && (
                        <p className="text-xs text-green-400">+{record.reviewsNew} new</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="text-lg font-bold">{formatDuration(record.durationSeconds)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cost</p>
                      <p className="text-lg font-bold">${record.costUsd.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Next Crawl</p>
                      <p className="text-sm font-medium">
                        {record.nextRecommendedCrawl
                          ? new Date(record.nextRecommendedCrawl).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Crawl History</h3>
            <p className="text-muted-foreground">
              This business hasn't been crawled yet
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
