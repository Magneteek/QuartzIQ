'use client'

import { format } from 'date-fns'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Star, ExternalLink, MapPin, MessageSquare, User } from 'lucide-react'
import { getValidReviewUrl, getReviewLinkLabel, shouldShowReviewLink } from '@/lib/review-url-utils'

interface ReviewCardProps {
  review: {
    title: string
    address: string
    name: string
    stars: number
    publishedAtDate: string
    text: string
    reviewerNumberOfReviews: number
    isLocalGuide: boolean
    originalLanguage: string
    reviewUrl: string
    reviewerUrl: string
    url: string
  }
}

export function ReviewCard({ review }: ReviewCardProps) {
  const getStarRating = (stars: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < stars ? 'text-primary fill-current' : 'text-gray-300'
        }`}
      />
    ))
  }

  const getDaysAgo = (date: string) => {
    const reviewDate = new Date(date)
    const today = new Date()
    const diffTime = today.getTime() - reviewDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getInitials = (name: string) => {
    if (!name) return 'A'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getRatingBadgeColor = (stars: number) => {
    if (stars >= 4) return 'bg-green-100 text-green-800'
    if (stars >= 3) return 'bg-yellow-100 text-yellow-800'
    if (stars >= 2) return 'bg-orange-100 text-orange-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {getInitials(review.name)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{review.name || 'Anonymous'}</h3>
                {review.isLocalGuide && (
                  <Badge variant="secondary" className="text-xs">
                    Local Guide
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                {review.reviewerNumberOfReviews || 0} reviews
              </div>
            </div>
          </div>
          <div className="text-right space-y-1">
            <Badge className={getRatingBadgeColor(review.stars)}>
              {review.stars}⭐
            </Badge>
            <div className="text-xs text-muted-foreground">
              {getDaysAgo(review.publishedAtDate)}d ago
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Business Info */}
        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
          <div className="font-medium text-sm line-clamp-1">{review.title}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="line-clamp-1">{review.address}</span>
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {getStarRating(review.stars)}
          </div>
          <span className="text-sm text-muted-foreground">
            {format(new Date(review.publishedAtDate), 'MMM dd, yyyy')}
          </span>
        </div>

        {/* Review Text */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Review</span>
            <Badge variant="outline" className="text-xs">
              {review.originalLanguage?.toUpperCase()}
            </Badge>
          </div>
          <div className="text-sm leading-relaxed bg-background border rounded-lg p-3 line-clamp-4">
            {review.text || 'No review text provided'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {shouldShowReviewLink(review.reviewUrl, review.url) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const validUrl = getValidReviewUrl(review.reviewUrl, review.url)
                if (validUrl) {
                  window.open(validUrl, '_blank')
                }
              }}
              className="flex-1 text-xs"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              {getReviewLinkLabel(review.reviewUrl, review.url)}
            </Button>
          )}
          {review.url && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(review.url, '_blank')}
              className="flex-1 text-xs"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Business
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}