'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Star,
  MapPin,
  Building,
  Phone,
  Mail,
  Globe,
  Calendar,
  RefreshCw,
  TrendingDown,
  AlertCircle,
  User,
  MessageSquare,
  Image as ImageIcon,
  Filter,
  X,
  CheckCircle2,
  UserCheck,
  ExternalLink
} from 'lucide-react'

interface QualifiedReview {
  review_id: string
  business_id: string
  business_name: string
  business_category: string
  business_city: string
  business_phone: string
  business_website: string
  business_email: string
  business_first_name: string | null
  business_last_name: string | null
  business_address: string
  business_rating: number
  business_reviews_count: number
  business_lifecycle_stage: string
  business_enrichment_status: string | null
  business_place_id: string
  reviewer_name: string
  rating: number
  text: string
  published_date: string
  extracted_at: string
  sentiment_score: number | null
  sentiment_label: string | null
  complaint_category: string | null
  severity_score: number | null
  urgency_level: string | null
  raw_data?: any
}

interface Statistics {
  totalReviews: number
  averageRating: string
  uniqueBusinesses: number
  showing: number
  ratingBreakdown: {
    1: number
    2: number
    3: number
  }
}

export function QualifiedReviewsPanel() {
  const [reviews, setReviews] = useState<QualifiedReview[]>([])
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedReview, setExpandedReview] = useState<string | null>(null)

  // Filter state
  const [daysBack, setDaysBack] = useState<string>('any') // 7, 14, 21, 30, 60, 90, or 'any'
  const [maxRating, setMaxRating] = useState<string>('3') // 1, 2, or 3
  const [withImages, setWithImages] = useState<boolean>(false)

  const fetchQualifiedReviews = async () => {
    setLoading(true)
    try {
      // Build query params based on filters
      const params = new URLSearchParams({
        limit: '100',
        maxRating: maxRating,
        ...(daysBack !== 'any' && { daysBack: daysBack }),
        ...(withImages && { withImages: 'true' }),
      })

      const response = await fetch(`/api/qualified-reviews?${params}`)
      const data = await response.json()

      if (data.success) {
        setReviews(data.reviews)
        setStats(data.statistics)
      }
    } catch (error) {
      console.error('Failed to fetch qualified reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQualifiedReviews()
  }, [daysBack, maxRating, withImages])

  const getRatingColor = (rating: number) => {
    if (rating === 1) return 'bg-red-500/20 text-red-400 border-red-500/40'
    if (rating === 2) return 'bg-orange-500/20 text-orange-400 border-orange-500/40'
    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
  }

  const getUrgencyColor = (urgency: string | null) => {
    switch (urgency) {
      case 'critical': return 'bg-red-500/20 text-red-400'
      case 'high': return 'bg-orange-500/20 text-orange-400'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400'
      default: return 'bg-blue-500/20 text-blue-400'
    }
  }

  const isEnriched = (review: QualifiedReview) => {
    return (
      (review.business_email && review.business_email.trim()) ||
      (review.business_phone && review.business_phone.trim()) ||
      (review.business_first_name && review.business_last_name)
    )
  }

  const isCustomer = (review: QualifiedReview) => {
    return review.business_lifecycle_stage === 'customer'
  }

  const getReviewUrl = (review: QualifiedReview) => {
    // Construct Google Maps review URL using place_id and review_id
    if (review.business_place_id) {
      return `https://www.google.com/maps/place/?q=place_id:${review.business_place_id}`
    }
    return null
  }

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading qualified reviews...</span>
        </div>
      </Card>
    )
  }

  if (reviews.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No Qualified Reviews Found</h3>
        <p className="text-muted-foreground mb-4">
          Start crawling businesses to extract qualified leads from negative reviews
        </p>
        <Button onClick={fetchQualifiedReviews}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </Card>
    )
  }

  const resetFilters = () => {
    setDaysBack('any')
    setMaxRating('3')
    setWithImages(false)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Review Age Filter */}
          <div className="space-y-2">
            <Label htmlFor="daysBack" className="text-xs text-muted-foreground">
              Review Age
            </Label>
            <Select value={daysBack} onValueChange={setDaysBack}>
              <SelectTrigger id="daysBack">
                <SelectValue placeholder="Select age" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Age</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days ⭐</SelectItem>
                <SelectItem value="21">Last 21 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rating Filter */}
          <div className="space-y-2">
            <Label htmlFor="maxRating" className="text-xs text-muted-foreground">
              Max Rating
            </Label>
            <Select value={maxRating} onValueChange={setMaxRating}>
              <SelectTrigger id="maxRating">
                <SelectValue placeholder="Select rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">★ 1 star only</SelectItem>
                <SelectItem value="2">★★ 1-2 stars</SelectItem>
                <SelectItem value="3">★★★ 1-3 stars</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Images Filter */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Review Content</Label>
            <Button
              variant={withImages ? 'default' : 'outline'}
              onClick={() => setWithImages(!withImages)}
              className="w-full justify-start"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              {withImages ? 'With Images Only' : 'All Reviews'}
            </Button>
          </div>

          {/* Reset Button */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground invisible">Reset</Label>
            <Button
              variant="ghost"
              onClick={resetFilters}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Reset Filters
            </Button>
          </div>
        </div>

        {/* Active Filters Summary */}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Active filters:</span>
          {daysBack !== 'any' && (
            <Badge variant="secondary" className="text-xs">
              {daysBack} days
            </Badge>
          )}
          {maxRating !== '3' && (
            <Badge variant="secondary" className="text-xs">
              ≤{maxRating}★
            </Badge>
          )}
          {withImages && (
            <Badge variant="secondary" className="text-xs">
              <ImageIcon className="h-3 w-3 mr-1" />
              Images
            </Badge>
          )}
          {daysBack === 'any' && maxRating === '3' && !withImages && (
            <span className="text-muted-foreground/60">None</span>
          )}
        </div>
      </Card>

      {/* Statistics Header */}
      {stats && (
        <Card className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.totalReviews}</div>
              <div className="text-sm text-muted-foreground">Total Qualified Reviews</div>
              {stats.showing < stats.totalReviews && (
                <div className="text-xs text-muted-foreground/60 mt-1">
                  Showing {stats.showing}
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400">{stats.averageRating}</div>
              <div className="text-sm text-muted-foreground">Avg Rating</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.uniqueBusinesses}</div>
              <div className="text-sm text-muted-foreground">Unique Businesses</div>
            </div>
            <div className="text-center">
              <div className="flex justify-center gap-2">
                <Badge className="bg-red-500/20 text-red-400">★1: {stats.ratingBreakdown[1]}</Badge>
                <Badge className="bg-orange-500/20 text-orange-400">★2: {stats.ratingBreakdown[2]}</Badge>
                <Badge className="bg-yellow-500/20 text-yellow-400">★3: {stats.ratingBreakdown[3]}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">Rating Distribution</div>
            </div>
          </div>
        </Card>
      )}

      {/* Reviews List */}
      <div className="grid gap-4">
        {reviews.map((review, index) => (
          <motion.div
            key={review.review_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="p-4 hover:border-primary/50 transition-colors">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Building className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">{review.business_name}</h3>
                      <Badge className={getRatingColor(review.rating)}>
                        {[...Array(review.rating)].map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-current inline" />
                        ))}
                      </Badge>
                      {isCustomer(review) && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/40">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Customer
                        </Badge>
                      )}
                      {isEnriched(review) && !isCustomer(review) && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Enriched
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {review.business_city}
                      </span>
                      <span>{review.business_category}</span>
                      {review.urgency_level && (
                        <Badge className={getUrgencyColor(review.urgency_level)}>
                          {review.urgency_level} urgency
                        </Badge>
                      )}
                      {getReviewUrl(review) && (
                        <a
                          href={getReviewUrl(review) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View on Google
                        </a>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedReview(
                      expandedReview === review.review_id ? null : review.review_id
                    )}
                  >
                    {expandedReview === review.review_id ? 'Show Less' : 'Show More'}
                  </Button>
                </div>

                {/* Review Content */}
                <div className="bg-muted/30 p-3 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm">{review.reviewer_name}</div>
                        {review.raw_data?.reviewImageUrls?.length > 0 || review.raw_data?.images?.length > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            <ImageIcon className="h-3 w-3 mr-1" />
                            Has Image
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(review.published_date).toLocaleDateString()} • {Math.floor((new Date().getTime() - new Date(review.published_date).getTime()) / (1000 * 60 * 60 * 24))} days ago
                      </div>
                    </div>
                  </div>
                  <p className="text-sm line-clamp-3">{review.text}</p>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expandedReview === review.review_id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t pt-3 space-y-3">
                        {/* Contact Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {review.business_phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-primary" />
                              <span>{review.business_phone}</span>
                            </div>
                          )}
                          {review.business_email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-primary" />
                              <span className="truncate">{review.business_email}</span>
                            </div>
                          )}
                          {review.business_website && (
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-primary" />
                              <a
                                href={review.business_website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline truncate"
                              >
                                {review.business_website}
                              </a>
                            </div>
                          )}
                          {review.complaint_category && (
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-orange-400" />
                              <span className="text-orange-400">{review.complaint_category}</span>
                            </div>
                          )}
                        </div>

                        {/* Review Images */}
                        {(review.raw_data?.reviewImageUrls?.length > 0 || review.raw_data?.images?.length > 0) && (
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <ImageIcon className="h-4 w-4 text-blue-400" />
                              <span className="text-sm font-medium text-blue-400">Review Images</span>
                            </div>
                            <div className="space-y-1">
                              {(review.raw_data?.reviewImageUrls || review.raw_data?.images || []).map((url: string, idx: number) => (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-blue-300 hover:text-blue-400 hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Image {idx + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                          Extracted: {new Date(review.extracted_at).toLocaleString()}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button onClick={fetchQualifiedReviews} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Reviews
        </Button>
      </div>
    </div>
  )
}
