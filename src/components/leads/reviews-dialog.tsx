'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Star, AlertCircle, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'

interface Review {
  id: string
  reviewer_name: string
  rating: number
  text: string
  published_date: string
  sentiment_label: string | null
  complaint_category: string | null
  severity_score: number | null
  urgency_level: string | null
}

interface ReviewsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  businessName: string
}

export function ReviewsDialog({
  open,
  onOpenChange,
  businessId,
  businessName,
}: ReviewsDialogProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && businessId) {
      fetchReviews()
    }
  }, [open, businessId])

  const fetchReviews = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/leads/${businessId}/reviews`)
      if (response.ok) {
        const data = await response.json()
        setReviews(data)
      }
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRatingColor = (rating: number) => {
    if (rating <= 2) return 'text-red-500'
    if (rating === 3) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getSeverityBadge = (severity: number | null) => {
    if (!severity) return null
    if (severity >= 8) return <Badge variant="destructive">Critical</Badge>
    if (severity >= 6) return <Badge className="bg-orange-500">High</Badge>
    if (severity >= 4) return <Badge className="bg-yellow-500">Medium</Badge>
    return <Badge variant="secondary">Low</Badge>
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Reviews for {businessName}
          </DialogTitle>
          <DialogDescription>
            {reviews.length} review{reviews.length !== 1 ? 's' : ''} found
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Loading reviews...
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              No reviews found for this business
            </div>
          ) : (
            reviews.map((review) => (
              <div
                key={review.id}
                className="border rounded-lg p-4 space-y-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{review.reviewer_name}</div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(review.published_date), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(review.severity_score)}
                    <div className={`flex items-center gap-1 ${getRatingColor(review.rating)}`}>
                      <Star className="h-4 w-4 fill-current" />
                      <span className="font-bold">{review.rating}</span>
                    </div>
                  </div>
                </div>

                {/* Review Text */}
                <div className="text-sm leading-relaxed">
                  {review.text}
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap gap-2">
                  {review.sentiment_label && (
                    <Badge variant="outline" className="text-xs">
                      {review.sentiment_label}
                    </Badge>
                  )}
                  {review.complaint_category && (
                    <Badge variant="outline" className="text-xs bg-blue-50">
                      {review.complaint_category}
                    </Badge>
                  )}
                  {review.urgency_level && (
                    <Badge variant="outline" className="text-xs">
                      Urgency: {review.urgency_level}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
