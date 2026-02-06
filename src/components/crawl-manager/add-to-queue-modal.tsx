'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  X,
  Plus,
  AlertCircle,
  DollarSign,
  Clock,
  Settings,
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AddToQueueModalProps {
  isOpen: boolean
  onClose: () => void
  selectedBusinessIds: string[]
  onSuccess?: () => void
}

interface CrawlConfig {
  maxReviewsPerBusiness: number
  maxReviewStars: number
  requireContent: boolean  // Must have text OR image
  incremental: boolean
}

export function AddToQueueModal({
  isOpen,
  onClose,
  selectedBusinessIds,
  onSuccess
}: AddToQueueModalProps) {
  const [batchName, setBatchName] = useState(`Batch ${new Date().toLocaleDateString()}`)
  const [priority, setPriority] = useState(75)
  const [config, setConfig] = useState<CrawlConfig>({
    maxReviewsPerBusiness: 2,
    maxReviewStars: 3,
    requireContent: true,  // Default: must have text OR image
    incremental: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Cost calculation
  const estimatedCost = selectedBusinessIds.length * 0.02
  const estimatedDuration = selectedBusinessIds.length * 3 // 3 seconds per business

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get organization ID from somewhere (you might want to pass this as a prop)
      const organizationId = '95a2d0b2-ab13-4209-89fc-f0f495345397' // TODO: Make this dynamic

      const response = await fetch('/api/crawl/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId,
          businessIds: selectedBusinessIds,
          batchName,
          priority,
          crawlConfig: config
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to add businesses to queue')
      }

      setSuccess(true)
      setTimeout(() => {
        onSuccess?.()
        onClose()
        setSuccess(false)
      }, 1500)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to queue')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl"
        >
          <Card className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Plus className="h-6 w-6 text-primary" />
                  Add to Crawl Queue
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure batch settings for {selectedBusinessIds.length} businesses
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {success ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-12 text-center"
              >
                <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-green-400 mb-2">
                  Successfully Added to Queue!
                </h3>
                <p className="text-muted-foreground">
                  {selectedBusinessIds.length} businesses are now queued for crawling
                </p>
              </motion.div>
            ) : (
              <>
                {/* Batch Configuration */}
                <div className="space-y-6">
                  {/* Batch Name */}
                  <div>
                    <Label htmlFor="batchName" className="text-sm font-medium mb-2 block">
                      Batch Name
                    </Label>
                    <Input
                      id="batchName"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="e.g., Amsterdam Tandarts - Initial Crawl"
                      className="w-full"
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <Label htmlFor="priority" className="text-sm font-medium mb-2 block">
                      Priority: {priority}
                    </Label>
                    <input
                      id="priority"
                      type="range"
                      min="0"
                      max="100"
                      value={priority}
                      onChange={(e) => setPriority(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Low (0)</span>
                      <span>High (100)</span>
                    </div>
                  </div>

                  {/* Crawl Configuration */}
                  <div className="border border-border rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Settings className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Crawl Configuration</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="maxReviews" className="text-sm font-medium mb-2 block">
                          Max Reviews per Business
                        </Label>
                        <Input
                          id="maxReviews"
                          type="number"
                          min="1"
                          max="10"
                          value={config.maxReviewsPerBusiness}
                          onChange={(e) => setConfig({
                            ...config,
                            maxReviewsPerBusiness: parseInt(e.target.value) || 2
                          })}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Cost: ${(config.maxReviewsPerBusiness * 0.01).toFixed(3)}/business
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="maxStars" className="text-sm font-medium mb-2 block">
                          Max Review Stars
                        </Label>
                        <select
                          id="maxStars"
                          value={config.maxReviewStars}
                          onChange={(e) => setConfig({
                            ...config,
                            maxReviewStars: parseInt(e.target.value)
                          })}
                          className="w-full p-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="1">1 star</option>
                          <option value="2">2 stars</option>
                          <option value="3">3 stars</option>
                          <option value="4">4 stars</option>
                          <option value="5">5 stars</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-2 pt-6">
                        <input
                          type="checkbox"
                          id="requireContent"
                          checked={config.requireContent}
                          onChange={(e) => setConfig({
                            ...config,
                            requireContent: e.target.checked
                          })}
                          className="rounded"
                        />
                        <div>
                          <Label htmlFor="requireContent" className="text-sm font-medium cursor-pointer block">
                            Require Content
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Reviews must have text OR image
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 pt-6">
                        <input
                          type="checkbox"
                          id="incremental"
                          checked={config.incremental}
                          onChange={(e) => setConfig({
                            ...config,
                            incremental: e.target.checked
                          })}
                          className="rounded"
                        />
                        <Label htmlFor="incremental" className="text-sm font-medium cursor-pointer">
                          Incremental Crawl
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Cost Estimation */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-600/10 border-green-500/20">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-8 w-8 text-green-400" />
                        <div>
                          <p className="text-sm text-muted-foreground">Estimated Cost</p>
                          <p className="text-2xl font-bold text-green-300">
                            ${estimatedCost.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-600/10 border-blue-500/20">
                      <div className="flex items-center gap-3">
                        <Clock className="h-8 w-8 text-blue-400" />
                        <div>
                          <p className="text-sm text-muted-foreground">Estimated Duration</p>
                          <p className="text-2xl font-bold text-blue-300">
                            {formatDuration(estimatedDuration)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300"
                    >
                      <AlertCircle className="h-5 w-5" />
                      <p className="text-sm">{error}</p>
                    </motion.div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      onClick={onClose}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={loading || !batchName.trim()}
                      className="gap-2"
                    >
                      {loading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          >
                            <Settings className="h-4 w-4" />
                          </motion.div>
                          Adding to Queue...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Add to Queue
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
