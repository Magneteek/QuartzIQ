'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ExternalLink, Star, MapPin, User, Calendar, MessageSquare, Building2 } from 'lucide-react'
import { getValidReviewUrl, getReviewLinkLabel, shouldShowReviewLink } from '@/lib/review-url-utils'

interface Review {
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

interface ResultsListProps {
  results: {
    businesses: Record<string, unknown>[]
    reviews: Record<string, unknown>[]
    searchCriteria: Record<string, unknown>
    extractionDate: Date
  }
}

export function ResultsList({ results }: ResultsListProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(6)
  const [filterBy, setFilterBy] = useState<'all' | 'rating' | 'business'>('all')
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null)

  // Get unique businesses
  const uniqueBusinesses = Array.from(new Set(results.reviews.map((r: any) => r.title))).filter(Boolean)

  // Filter reviews
  let filteredReviews = results.reviews

  if (filterBy === 'rating' && selectedRating !== null) {
    filteredReviews = results.reviews.filter((review: any) => review.stars === selectedRating)
  }

  if (filterBy === 'business' && selectedBusiness) {
    filteredReviews = results.reviews.filter((review: any) => review.title === selectedBusiness)
  }

  const paginatedReviews = filteredReviews.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const totalPages = Math.ceil(filteredReviews.length / pageSize)

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

  const resetFilters = () => {
    setFilterBy('all')
    setSelectedRating(null)
    setSelectedBusiness(null)
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant={filterBy === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={resetFilters}
              >
                All Reviews ({results.reviews.length})
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">By Rating:</span>
              {[1, 2, 3, 4, 5].map(rating => {
                const count = results.reviews.filter((r: any) => r.stars === rating).length
                return (
                  <Button
                    key={rating}
                    variant={filterBy === 'rating' && selectedRating === rating ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setFilterBy('rating')
                      setSelectedRating(rating)
                      setCurrentPage(1)
                    }}
                    disabled={count === 0}
                  >
                    {rating}★ ({count})
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">By Business:</span>
            {uniqueBusinesses.slice(0, 5).map(business => {
              const count = results.reviews.filter((r: any) => r.title === business).length
              return (
                <Button
                  key={business}
                  variant={filterBy === 'business' && selectedBusiness === business ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFilterBy('business')
                    setSelectedBusiness(business)
                    setCurrentPage(1)
                  }}
                  className="text-xs"
                >
                  {business?.slice(0, 20)}... ({count})
                </Button>
              )
            })}
            {uniqueBusinesses.length > 5 && (
              <span className="text-sm text-muted-foreground">
                +{uniqueBusinesses.length - 5} more
              </span>
            )}
          </div>

          {(filterBy !== 'all') && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing {filteredReviews.length} of {results.reviews.length} reviews
              </span>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Cards */}
      <div className="grid gap-6">
        {paginatedReviews.map((review: any, index) => (
          <Card key={index} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>{getInitials(review.name)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{review.name || 'Anonymous Reviewer'}</h3>
                      {review.isLocalGuide && (
                        <Badge variant="secondary" className="text-xs">
                          Local Guide
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      {review.reviewerNumberOfReviews || 0} reviews
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center gap-1">
                    {getStarRating(review.stars)}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(review.publishedAtDate), 'MMM dd, yyyy')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getDaysAgo(review.publishedAtDate)} days ago
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Business Info */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium text-sm">{review.title || 'Unknown Business'}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {review.address || 'Address not available'}
                </div>
              </div>

              {/* Review Text */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-sm font-medium">Review</span>
                  <Badge variant="outline" className="text-xs">
                    {review.originalLanguage?.toUpperCase() || 'Unknown'}
                  </Badge>
                </div>
                <div className="text-sm leading-relaxed bg-background border rounded-lg p-3">
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
                    className="flex-1"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {getReviewLinkLabel(review.reviewUrl, review.url)}
                  </Button>
                )}
                {review.reviewerUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(review.reviewerUrl, '_blank')}
                    className="flex-1"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Reviewer Profile
                  </Button>
                )}
                {review.url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(review.url, '_blank')}
                    className="flex-1"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Business Page
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredReviews.length)} of {filteredReviews.length} reviews
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredReviews.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No reviews found</h3>
            <p className="text-muted-foreground mb-4">
              No reviews match your current filter criteria.
            </p>
            <Button onClick={resetFilters}>
              Clear All Filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}