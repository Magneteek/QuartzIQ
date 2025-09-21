'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin, Building, MessageSquare, X, Loader2 } from 'lucide-react'

interface ExtractionHistoryItem {
  id: string
  timestamp: string
  category: string
  location: string
  businessesFound: number
  reviewsFound: number
  extractionTime: number
}

interface ExtractionHistoryProps {
  onLoadExtraction: (id: string) => void
  onClose: () => void
}

export function ExtractionHistory({ onLoadExtraction, onClose }: ExtractionHistoryProps) {
  const [history, setHistory] = useState<ExtractionHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/history?action=list')
      const data = await response.json()

      if (data.success) {
        setHistory(data.data || [])
      } else {
        setError(data.error || 'Failed to load history')
      }
    } catch (err) {
      setError('Failed to load extraction history')
      console.error('History load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'clinic': return 'bg-blue-100 text-blue-800'
      case 'hotel': return 'bg-green-100 text-green-800'
      case 'tandarts': return 'bg-purple-100 text-purple-800'
      case 'restaurant': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading extraction history...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={loadHistory} variant="outline">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Extraction History</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No extraction history found
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {history.map((item) => (
            <Card key={item.id} className="cursor-pointer hover:bg-gray-50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={getCategoryColor(item.category)}>
                      {item.category.toUpperCase()}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <MapPin className="h-3 w-3" />
                      {item.location}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    {formatDate(item.timestamp)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      {item.businessesFound} businesses
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {item.reviewsFound} reviews
                    </div>
                    <div className="text-xs">
                      {formatDuration(item.extractionTime)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onLoadExtraction(item.id)}
                    className="ml-auto"
                  >
                    Load
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}