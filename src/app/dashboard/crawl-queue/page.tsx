'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  RefreshCw,
  PlayCircle,
  PauseCircle,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Package
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// Types
interface BatchProgress {
  batchId: string
  batchName: string
  organizationId: string
  businessCount: number
  status: string
  progress: number
  completed: number
  failed: number
  queued: number
  inProgress: number
  totalReviews: number
  totalCost: number
  queuedAt: string
}

interface QueueStatus {
  success: boolean
  batches: BatchProgress[]
  stats: {
    totalQueued: number
    totalInProgress: number
    estimatedTotalCost: number
  }
}

export default function CrawlQueuePage() {
  const [queueData, setQueueData] = useState<QueueStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Load queue data
  const loadQueue = async () => {
    try {
      const response = await fetch('/api/crawl/queue')
      const data = await response.json()
      if (data.success) {
        setQueueData(data)
      }
    } catch (error) {
      console.error('Failed to load queue:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadQueue()
  }, [])

  // Auto-refresh every 5 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      loadQueue()
    }, 5000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  const handleStartCrawl = async (batchId: string) => {
    try {
      const response = await fetch('/api/crawl/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ batchId })
      })

      if (response.ok) {
        loadQueue() // Refresh queue
      }
    } catch (error) {
      console.error('Failed to start crawl:', error)
    }
  }

  const handleCancelBatch = async (batchId: string) => {
    if (!confirm('Are you sure you want to cancel this batch?')) return

    try {
      const response = await fetch(`/api/crawl/queue?batchId=${batchId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadQueue() // Refresh queue
      }
    } catch (error) {
      console.error('Failed to cancel batch:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'in_progress':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
      case 'completed':
        return 'bg-green-500/20 text-green-300 border-green-500/30'
      case 'failed':
        return 'bg-red-500/20 text-red-300 border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock className="h-5 w-5" />
      case 'in_progress':
        return <RefreshCw className="h-5 w-5 animate-spin" />
      case 'completed':
        return <CheckCircle2 className="h-5 w-5" />
      case 'failed':
        return <AlertCircle className="h-5 w-5" />
      default:
        return <Package className="h-5 w-5" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
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
            <Link href="/dashboard/crawl-manager">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Manager
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                Crawl Queue Monitor
              </h1>
              <p className="text-muted-foreground mt-1">
                Monitor active crawl batches and their progress in real-time
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', autoRefresh && 'animate-spin')} />
              {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
            </Button>
            <Button
              onClick={loadQueue}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Now
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {queueData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-600/10 border-blue-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Queued</p>
                  <p className="text-2xl font-bold text-blue-300">
                    {queueData.stats.totalQueued}
                  </p>
                </div>
                <Package className="h-8 w-8 text-blue-400" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-600/10 border-yellow-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold text-yellow-300">
                    {queueData.stats.totalInProgress}
                  </p>
                </div>
                <RefreshCw className="h-8 w-8 text-yellow-400 animate-spin" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-600/10 border-green-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Estimated Cost</p>
                  <p className="text-2xl font-bold text-green-300">
                    ${queueData.stats.estimatedTotalCost.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-400" />
              </div>
            </Card>
          </div>
        )}
      </motion.div>

      {/* Active Batches */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Active Batches ({queueData?.batches.length || 0})
          </h2>
        </div>

        {loading ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <RefreshCw className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading queue data...</p>
            </div>
          </Card>
        ) : queueData && queueData.batches.length > 0 ? (
          <div className="space-y-4">
            {queueData.batches.map((batch) => (
              <motion.div
                key={batch.batchId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-6">
                  {/* Batch Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{batch.batchName}</h3>
                        <span className={cn(
                          'px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1',
                          getStatusColor(batch.status)
                        )}>
                          {getStatusIcon(batch.status)}
                          {batch.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Queued at: {formatDate(batch.queuedAt)}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {batch.status === 'queued' && (
                        <Button
                          onClick={() => handleStartCrawl(batch.batchId)}
                          size="sm"
                          variant="default"
                          className="gap-2"
                        >
                          <PlayCircle className="h-4 w-4" />
                          Start
                        </Button>
                      )}
                      {batch.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled
                        >
                          <PauseCircle className="h-4 w-4" />
                          Pause
                        </Button>
                      )}
                      {(batch.status === 'queued' || batch.status === 'in_progress') && (
                        <Button
                          onClick={() => handleCancelBatch(batch.batchId)}
                          size="sm"
                          variant="destructive"
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        Progress: {batch.completed} / {batch.businessCount}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {batch.progress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-background rounded-full h-3 overflow-hidden border border-border">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-primary/70"
                        initial={{ width: 0 }}
                        animate={{ width: `${batch.progress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>

                  {/* Statistics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-xs text-muted-foreground mb-1">Total</p>
                      <p className="text-lg font-bold">{batch.businessCount}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <p className="text-xs text-muted-foreground mb-1">Completed</p>
                      <p className="text-lg font-bold text-green-300">{batch.completed}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                      <p className="text-xs text-muted-foreground mb-1">Failed</p>
                      <p className="text-lg font-bold text-red-300">{batch.failed}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <p className="text-xs text-muted-foreground mb-1">Reviews</p>
                      <p className="text-lg font-bold text-blue-300">{batch.totalReviews}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                      <p className="text-xs text-muted-foreground mb-1">Cost</p>
                      <p className="text-lg font-bold text-yellow-300">
                        ${batch.totalCost.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Active Batches</h3>
              <p className="text-muted-foreground mb-4">
                There are no crawl batches in the queue right now
              </p>
              <Link href="/dashboard/crawl-manager">
                <Button variant="default">
                  Go to Crawl Manager
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
