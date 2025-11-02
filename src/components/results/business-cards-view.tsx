'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building, MapPin, Star, Phone, Globe, MessageSquare, DollarSign, Database } from 'lucide-react'

interface BusinessCardsViewProps {
  results: {
    businesses: any[]
    reviews: any[]
    cache?: {
      businesses_cached: number
      businesses_new: number
      reviews_cached: number
      reviews_new: number
    }
    cost?: {
      savings_usd: number
      cache_hit_rate: string
    }
  }
}

export function BusinessCardsView({ results }: BusinessCardsViewProps) {
  const { businesses, reviews, cache, cost } = results

  // Group reviews by business
  const reviewsByBusiness = reviews.reduce((acc: any, review: any) => {
    const businessName = review.title || review.businessName || review.business_name || 'Unknown Business'
    if (!acc[businessName]) acc[businessName] = []
    acc[businessName].push(review)
    return acc
  }, {})

  const getBusinessReviews = (businessName: string) => {
    return reviewsByBusiness[businessName] || []
  }

  if (businesses.length === 0) {
    return (
      <div className="text-center py-12">
        <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">No businesses found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cache Summary Card */}
      {cache && (
        <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <Database className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cached</p>
                  <p className="text-xl font-bold text-green-400">{cache.businesses_cached}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Building className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">New</p>
                  <p className="text-xl font-bold text-blue-400">{cache.businesses_new}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <MessageSquare className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reviews</p>
                  <p className="text-xl font-bold text-purple-400">{reviews.length}</p>
                </div>
              </div>

              {cost && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <DollarSign className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saved</p>
                    <p className="text-xl font-bold text-yellow-400">${cost.savings_usd.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>

            {cost && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Cache hit rate: <span className="font-semibold text-primary">{cost.cache_hit_rate}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Business Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {businesses.map((business: any, index: number) => {
          const businessName = business.title || business.name || business.business_name || 'Unknown Business'
          const businessReviews = getBusinessReviews(businessName)
          const hasReviews = businessReviews.length > 0
          const isCached = cache ? index < cache.businesses_cached : false

          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                {/* Business Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground line-clamp-1">
                        {businessName}
                      </h3>
                      {isCached && (
                        <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-400">
                          <Database className="h-3 w-3 mr-1" />
                          Cached
                        </Badge>
                      )}
                    </div>

                    {/* Rating */}
                    {business.totalScore && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{Number(business.totalScore).toFixed(1)}</span>
                        </div>
                        <span className="text-muted-foreground">
                          ({business.reviewsCount || 0} reviews)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Business Info */}
                <div className="space-y-2 text-sm text-muted-foreground">
                  {business.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{business.address}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    {business.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        <span>{business.phone}</span>
                      </div>
                    )}

                    {business.website && (
                      <a
                        href={business.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <Globe className="h-4 w-4" />
                        Website
                      </a>
                    )}
                  </div>
                </div>

                {/* Review Status */}
                <div className="mt-4 pt-4 border-t border-border/50">
                  {hasReviews ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span className="text-foreground font-medium">
                          {businessReviews.length} reviews loaded
                        </span>
                      </div>
                      <Button variant="outline" size="sm">
                        View Reviews
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          0 reviews in cache
                        </span>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1">
                        <DollarSign className="h-3 w-3" />
                        Fetch Reviews ($0.02)
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
