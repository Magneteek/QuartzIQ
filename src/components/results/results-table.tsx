'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { ExternalLink, Star, MapPin, User, Calendar, MessageSquare, Phone, Mail, Globe, Users, Award } from 'lucide-react'
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

interface ResultsTableProps {
  results: {
    businesses: Record<string, unknown>[]
    reviews: Record<string, unknown>[]
    searchCriteria: Record<string, unknown>
    extractionDate: Date
  }
  qualifyingBusinesses: any[]
  selectedReviews: Set<string>
  onReviewSelect: (reviewIndex: number, isSelected: boolean) => void
  selectAll: boolean
  onSelectAll: (selectAll: boolean) => void
}

export function ResultsTable({ results, qualifyingBusinesses, selectedReviews, onReviewSelect, selectAll, onSelectAll }: ResultsTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState<'date' | 'rating' | 'business' | 'quality'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Function to get lead quality data for a business
  const getLeadQuality = (businessTitle: string) => {
    const qualifyingBusiness = qualifyingBusinesses.find((b: any) => b.title === businessTitle)
    return qualifyingBusiness?.leadQuality || null
  }

  const sortedReviews = [...results.reviews].sort((a: any, b: any) => {
    let comparison = 0

    switch (sortBy) {
      case 'date':
        comparison = new Date(a.publishedAtDate).getTime() - new Date(b.publishedAtDate).getTime()
        break
      case 'rating':
        comparison = a.stars - b.stars
        break
      case 'business':
        comparison = a.title.localeCompare(b.title)
        break
      case 'quality':
        const qualityA = getLeadQuality(a.title)?.score || 0
        const qualityB = getLeadQuality(b.title)?.score || 0
        comparison = qualityA - qualityB
        break
    }

    return sortOrder === 'asc' ? comparison : -comparison
  })

  const paginatedReviews = sortedReviews.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const totalPages = Math.ceil(results.reviews.length / pageSize)

  const handleSort = (field: 'date' | 'rating' | 'business' | 'quality') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

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

  return (
    <div className="space-y-4">

      {/* Selection Controls */}
      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={(e) => onSelectAll(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">
              Select All Reviews ({selectedReviews.size}/{results.reviews.length} selected)
            </span>
          </label>
        </div>
        <div className="text-sm text-muted-foreground">
          💡 Select reviews for targeted contact enrichment
        </div>
      </div>

      {/* Table Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Button
            variant={sortBy === 'date' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSort('date')}
          >
            Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Button>
          <Button
            variant={sortBy === 'rating' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSort('rating')}
          >
            Rating {sortBy === 'rating' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Button>
          <Button
            variant={sortBy === 'business' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSort('business')}
          >
            Business {sortBy === 'business' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Button>
          <Button
            variant={sortBy === 'quality' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSort('quality')}
            className="gap-1"
          >
            <Award className="h-3 w-3" />
            Quality {sortBy === 'quality' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value))
              setCurrentPage(1)
            }}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-muted-foreground">per page</span>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Select</TableHead>
              <TableHead className="w-[250px]">Business & Contact</TableHead>
              <TableHead className="w-[100px]">Rating</TableHead>
              <TableHead className="w-[110px]">Lead Quality</TableHead>
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead>Review Text</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedReviews.map((review: any, index) => {
              const globalIndex = (currentPage - 1) * pageSize + index
              const isSelected = selectedReviews.has(globalIndex.toString())

              return (
                <TableRow key={index}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onReviewSelect(globalIndex, e.target.checked)}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{review.title || 'Unknown Business'}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {review.address || 'Address not available'}
                      </div>
                    </div>

                    {/* Contact Information */}
                    {(() => {
                      const business = results.businesses.find((b: any) => b.title === review.title)
                      if (!business) return null

                      const hasContact = business.phone || business.email || business.website
                      if (!hasContact) return (
                        <div className="text-xs text-muted-foreground italic">
                          No contact information available
                        </div>
                      )

                      return (
                        <div className="space-y-1">
                          {Boolean(business.phone) && (
                            <div className="text-xs flex items-center gap-1">
                              <Phone className="h-3 w-3 text-primary" />
                              <a href={`tel:${business.phone}`} className="hover:underline">
                                {String(business.phone)}
                              </a>
                            </div>
                          )}
                          {Boolean(business.email) && (
                            <div className="text-xs flex items-center gap-1">
                              <Mail className="h-3 w-3 text-primary" />
                              <a href={`mailto:${business.email}`} className="hover:underline">
                                {String(business.email)}
                              </a>
                            </div>
                          )}
                          {Boolean(business.website) && (
                            <div className="text-xs flex items-center gap-1">
                              <Globe className="h-3 w-3 text-primary" />
                              <a href={String(business.website)} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                Website
                              </a>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {getStarRating(review.stars)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {review.stars}/5
                  </div>
                </TableCell>
                <TableCell>
                  {(() => {
                    const leadQuality = getLeadQuality(review.title)
                    if (!leadQuality) {
                      return (
                        <div className="text-xs text-muted-foreground">
                          No quality data
                        </div>
                      )
                    }

                    const getTierColor = (tier: string) => {
                      switch (tier.toLowerCase()) {
                        case 'platinum': return 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30 text-yellow-400'
                        case 'gold': return 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400'
                        case 'silver': return 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400'
                        default: return 'bg-gradient-to-r from-gray-500/20 to-slate-500/20 border-gray-500/30 text-gray-400'
                      }
                    }

                    return (
                      <div className="space-y-1">
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${getTierColor(leadQuality.tier)}`}>
                          <Award className="h-3 w-3" />
                          <span className="text-xs font-medium">{leadQuality.tier}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {leadQuality.score}/100
                        </div>
                      </div>
                    )
                  })()}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {review.publishedAtDate && !isNaN(new Date(review.publishedAtDate).getTime())
                        ? format(new Date(review.publishedAtDate), 'MMM dd, yyyy')
                        : 'Unknown date'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {review.publishedAtDate && !isNaN(new Date(review.publishedAtDate).getTime())
                        ? `${getDaysAgo(review.publishedAtDate)} days ago`
                        : 'Date unavailable'}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-xs">
                    <div className="text-sm line-clamp-3">
                      {review.text || 'No text provided'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {review.originalLanguage?.toUpperCase() || 'Unknown'}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {shouldShowReviewLink(review.reviewUrl, review.url) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          const validUrl = getValidReviewUrl(review.reviewUrl, review.url)
                          if (validUrl) {
                            window.open(validUrl, '_blank')
                          }
                        }}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {getReviewLinkLabel(review.reviewUrl, review.url)}
                      </Button>
                    )}
                    {review.url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => window.open(review.url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Business
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, results.reviews.length)} of {results.reviews.length} reviews
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
    </div>
  )
}