'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, MapPin, ExternalLink, Phone } from 'lucide-react'

interface BusinessCardProps {
  business: {
    title: string
    address: string
    totalScore: number
    reviewsCount: number
    url: string
    phone?: string
    website?: string
  }
}

export function BusinessCard({ business }: BusinessCardProps) {
  const getStarRating = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) ? 'text-primary fill-current' : 'text-gray-300'
        }`}
      />
    ))
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'bg-green-100 text-green-800'
    if (rating >= 4.0) return 'bg-yellow-100 text-yellow-800'
    if (rating >= 3.5) return 'bg-orange-100 text-orange-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg line-clamp-2">{business.title}</CardTitle>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="line-clamp-1">{business.address}</span>
            </div>
          </div>
          <Badge className={getRatingColor(business.totalScore)}>
            {business.totalScore.toFixed(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rating Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {getStarRating(business.totalScore)}
            </div>
            <span className="text-sm text-muted-foreground">
              ({business.reviewsCount} reviews)
            </span>
          </div>
        </div>

        {/* Contact Info */}
        {business.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{business.phone}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {business.url && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => window.open(business.url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View on Google
            </Button>
          )}
          {business.website && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => window.open(business.website, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Website
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}