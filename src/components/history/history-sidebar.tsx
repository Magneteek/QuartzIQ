'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  ChevronRight
} from 'lucide-react'

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

export function HistorySidebar({ isOpen, onLoadExtraction, onClose, currentExtractionId }: HistorySidebarProps) {
  const [history, setHistory] = useState<ExtractionHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

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
      case 'clinic': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'hotel': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'tandarts': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'restaurant': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 z-50 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-96'
      } shadow-xl`}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {!isCollapsed && (
            <>
              <h3 className="font-semibold text-lg">Contact Vault</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCollapsed(true)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
          {isCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(false)}
              className="h-8 w-8 p-0 mx-auto"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Content */}
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto p-4">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm text-gray-600">Loading...</span>
              </div>
            )}

            {error && (
              <div className="text-center py-8">
                <div className="text-red-600 text-sm mb-3">{error}</div>
                <Button onClick={loadHistory} variant="outline" size="sm">
                  Try Again
                </Button>
              </div>
            )}

            {!loading && !error && history.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                No saved extractions in your vault yet
              </div>
            )}

            {!loading && !error && history.length > 0 && (
              <div className="space-y-3">
                {history.map((item) => {
                  const latestEnrichment = getLatestEnrichment(item.enrichmentHistory)
                  const hasContacts = hasContactData(item.enrichmentHistory)
                  const isCurrentExtraction = currentExtractionId === item.id

                  return (
                    <Card
                      key={item.id}
                      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                        isCurrentExtraction
                          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => onLoadExtraction(item.id)}
                    >
                      <CardContent className="p-3">
                        {/* Header Row */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`${getCategoryColor(item.searchCriteria?.category || 'unknown')} text-xs`}>
                              {(item.searchCriteria?.category || 'UNKNOWN').toUpperCase()}
                            </Badge>
                            {hasContacts && (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(item.timestamp)}
                          </div>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{item.searchCriteria?.location || 'Unknown location'}</span>
                        </div>

                        {/* Statistics */}
                        <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                          <div className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {item.statistics?.businessesFound || 0}
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {item.statistics?.reviewsFound || 0}
                          </div>
                        </div>

                        {/* Contact Enrichment Stats */}
                        {latestEnrichment && (
                          <div className="flex items-center gap-3 text-xs">
                            {latestEnrichment.phoneNumbers > 0 && (
                              <div className="flex items-center gap-1 text-blue-600">
                                <Phone className="h-3 w-3" />
                                {latestEnrichment.phoneNumbers}
                              </div>
                            )}
                            {latestEnrichment.emails > 0 && (
                              <div className="flex items-center gap-1 text-green-600">
                                <Mail className="h-3 w-3" />
                                {latestEnrichment.emails}
                              </div>
                            )}
                            {latestEnrichment.websites > 0 && (
                              <div className="flex items-center gap-1 text-purple-600">
                                <Globe className="h-3 w-3" />
                                {latestEnrichment.websites}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Load Button */}
                        {!isCurrentExtraction && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-2 h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              onLoadExtraction(item.id)
                            }}
                          >
                            Load
                          </Button>
                        )}
                        {isCurrentExtraction && (
                          <div className="w-full mt-2 h-7 text-xs text-center text-blue-600 font-medium flex items-center justify-center">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Current
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Collapsed State Content */}
        {isCollapsed && (
          <div className="p-2">
            {!loading && !error && history.slice(0, 10).map((item) => {
              const hasContacts = hasContactData(item.enrichmentHistory)
              const isCurrentExtraction = currentExtractionId === item.id

              return (
                <div
                  key={item.id}
                  className={`w-12 h-12 rounded-lg border-2 mb-2 cursor-pointer transition-all duration-200 flex items-center justify-center ${
                    isCurrentExtraction
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => onLoadExtraction(item.id)}
                  title={`${item.searchCriteria?.category || 'Unknown'} - ${item.searchCriteria?.location || 'Unknown location'}`}
                >
                  {hasContacts ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Building className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}