'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Clock,
  MapPin,
  Building,
  MessageSquare,
  X,
  Loader2,
  CheckCircle,
  Phone,
  Mail,
  Globe,
  ChevronLeft,
  ChevronRight,
  Database,
  Star,
  TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface EnrichmentData {
  timestamp: Date
  enrichedBusinesses: number
  phoneNumbers: number
  websites: number
  emails: number
}

interface ExtractionHistoryItem {
  id: string
  timestamp: string
  searchCriteria: {
    category: string
    location: string
    countryCode: string
  }
  statistics: {
    businessesFound: number
    reviewsFound: number
    avgRating: number
    extractionTime: number
  }
  enrichmentHistory?: EnrichmentData[]
}

interface HistorySidebarProps {
  isOpen: boolean
  onLoadExtraction: (id: string) => void
  onClose: () => void
  currentExtractionId?: string | null
}

export function EnhancedHistorySidebar({ isOpen, onLoadExtraction, onClose, currentExtractionId }: HistorySidebarProps) {
  const [history, setHistory] = useState<ExtractionHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && !loading && history.length === 0) {
      loadHistory()
    }
  }, [isOpen])

  const loadHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/history?action=list')
      const data = await response.json()

      if (data.success) {
        setHistory(data.data || [])
      } else {
        setError(data.error || 'Failed to load contact vault')
      }
    } catch (err) {
      setError('Failed to load contact vault')
      console.error('Contact vault load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'clinic': return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'hotel': return 'bg-green-500/20 text-green-300 border-green-500/30'
      case 'tandarts': return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      case 'restaurant': return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
  }

  const getLatestEnrichment = (enrichmentHistory: EnrichmentData[] | undefined) => {
    if (!enrichmentHistory || enrichmentHistory.length === 0) return null
    return enrichmentHistory[enrichmentHistory.length - 1]
  }

  const hasContactData = (enrichmentHistory: EnrichmentData[] | undefined) => {
    const latest = getLatestEnrichment(enrichmentHistory)
    return latest && (latest.phoneNumbers > 0 || latest.emails > 0 || latest.websites > 0)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop without blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-transparent z-40"
            onClick={onClose}
          />

          {/* Enhanced Sidebar */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{
              duration: 0.2,
              ease: "easeOut"
            }}
            className={cn(
              "fixed top-0 right-0 h-full z-50 transition-all duration-150 shadow-2xl flex flex-col",
              "bg-background border border-border",
              isCollapsed ? 'w-16' : 'w-80'
            )}
          >
            {/* Header with Gradient */}
            <div className="bg-primary p-4 border-b border-white/10">
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Database className="h-6 w-6 text-white" />
                    <h3 className="font-bold text-lg text-white">Contact Vault</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCollapsed(true)}
                      className="h-8 w-8 p-0 text-white hover:bg-white/10"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClose}
                      className="h-8 w-8 p-0 text-white hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
              {isCollapsed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCollapsed(false)}
                  className="h-8 w-8 p-0 mx-auto text-white hover:bg-white/10"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Content */}
            {!isCollapsed && (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center py-8"
                  >
                    <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" />
                    <span className="text-sm text-muted-foreground">Loading vault...</span>
                  </motion.div>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-8"
                  >
                    <div className="text-destructive text-sm mb-3">{error}</div>
                    <Button onClick={loadHistory} variant="outline" size="sm">
                      Try Again
                    </Button>
                  </motion.div>
                )}

                {!loading && !error && history.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8 text-muted-foreground text-sm"
                  >
                    <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    No saved extractions in your vault yet
                  </motion.div>
                )}

                {!loading && !error && history.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-2"
                  >
                    {history.map((item, index) => {
                      const latestEnrichment = getLatestEnrichment(item.enrichmentHistory)
                      const hasContacts = hasContactData(item.enrichmentHistory)
                      const isCurrentExtraction = currentExtractionId === item.id

                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          onMouseEnter={() => setHoveredId(item.id)}
                          onMouseLeave={() => setHoveredId(null)}
                        >
                          <Card
                            className={cn(
                              "cursor-pointer transition-all duration-200 p-2",
                              isCurrentExtraction
                                ? 'ring-2 ring-primary bg-primary/5'
                                : 'hover:bg-card/50'
                            )}
                            onClick={() => onLoadExtraction(item.id)}
                          >
                            {/* Header Row */}
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <Badge className={cn(
                                  "text-xs font-medium",
                                  getCategoryColor(item.searchCriteria?.category || 'unknown')
                                )}>
                                  {(item.searchCriteria?.category || 'UNKNOWN').toUpperCase()}
                                </Badge>
                                {hasContacts && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2 }}
                                  >
                                    <CheckCircle className="h-4 w-4 status-success" />
                                  </motion.div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(item.timestamp)}
                              </div>
                            </div>

                            {/* Location */}
                            <div className="flex items-center gap-2 text-sm text-foreground mb-1">
                              <MapPin className="h-4 w-4 text-primary" />
                              <span className="truncate font-medium">
                                {item.searchCriteria?.location || 'Unknown location'}
                              </span>
                            </div>

                            {/* Compact Statistics Row */}
                            <div className="flex items-center gap-1 text-xs mb-1">
                              <div className="flex items-center gap-1 px-2 py-1 rounded bg-card/50">
                                <Building className="h-3 w-3 text-blue-400" />
                                <span className="font-medium text-foreground">
                                  {item.statistics?.businessesFound || 0}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 px-2 py-1 rounded bg-card/50">
                                <MessageSquare className="h-3 w-3 text-green-400" />
                                <span className="font-medium text-foreground">
                                  {item.statistics?.reviewsFound || 0}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 px-2 py-1 rounded bg-card/50">
                                <Star className="h-3 w-3 text-yellow-400" />
                                <span className="font-medium text-foreground">
                                  {item.statistics?.avgRating?.toFixed(1) || '0'}
                                </span>
                              </div>
                            </div>

                            {/* Contact Enrichment Stats */}
                            {latestEnrichment && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="flex items-center gap-2 text-xs p-1.5 rounded-lg bg-primary/10 border border-primary/20"
                              >
                                {latestEnrichment.phoneNumbers > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-blue-400" />
                                    <span className="font-medium">{latestEnrichment.phoneNumbers}</span>
                                  </div>
                                )}
                                {latestEnrichment.emails > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3 text-green-400" />
                                    <span className="font-medium">{latestEnrichment.emails}</span>
                                  </div>
                                )}
                                {latestEnrichment.websites > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Globe className="h-3 w-3 text-purple-400" />
                                    <span className="font-medium">{latestEnrichment.websites}</span>
                                  </div>
                                )}
                              </motion.div>
                            )}

                            {/* Action Button */}
                            <div className="mt-2">
                              {!isCurrentExtraction ? (
                                <Button
                                  size="sm"
                                  className="w-full h-8 text-xs bg-primary text-primary-foreground border-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onLoadExtraction(item.id)
                                  }}
                                >
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  Load Extraction
                                </Button>
                              ) : (
                                <div className="w-full h-8 text-xs text-center text-primary font-medium flex items-center justify-center bg-primary/10 rounded-md">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Currently Active
                                </div>
                              )}
                            </div>
                          </Card>
                        </motion.div>
                      )
                    })}
                  </motion.div>
                )}
              </div>
            )}

            {/* Collapsed State Content */}
            {isCollapsed && (
              <div className="p-2 space-y-2">
                {!loading && !error && history.slice(0, 8).map((item, index) => {
                  const hasContacts = hasContactData(item.enrichmentHistory)
                  const isCurrentExtraction = currentExtractionId === item.id

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "w-12 h-12 rounded-lg border-2 cursor-pointer transition-all duration-150 flex items-center justify-center hover:scale-105 hover:shadow-lg",
                        isCurrentExtraction
                          ? 'border-primary bg-primary/20'
                          : 'border hover:border-primary/50 bg-card/50'
                      )}
                      onClick={() => onLoadExtraction(item.id)}
                      title={`${item.searchCriteria?.category || 'Unknown'} - ${item.searchCriteria?.location || 'Unknown location'}`}
                    >
                      {hasContacts ? (
                        <CheckCircle className="h-5 w-5 status-success" />
                      ) : (
                        <Building className="h-4 w-4 text-muted-foreground" />
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}