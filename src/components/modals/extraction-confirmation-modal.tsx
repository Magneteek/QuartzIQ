'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Search, MapPin, Star, Calendar, Building2, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface SearchCriteria {
  category: string
  location: string
  maxStars?: number
  dayLimit?: number
  businessLimit?: number
  maxReviewsPerBusiness?: number
  // Universal format support
  limits?: {
    maxBusinesses?: number
    maxReviewsPerBusiness?: number
  }
  reviewFilters?: {
    enabled?: boolean
    maxStars?: number
    dayLimit?: number
  }
  enrichment?: {
    enabled?: boolean
  }
  useCached?: boolean
}

interface ExtractionConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  criteria: SearchCriteria | null
  useCached?: boolean
}

export function ExtractionConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  criteria,
  useCached = false
}: ExtractionConfirmationModalProps) {
  if (!criteria) return null

  // Helper functions to get values from either universal or legacy format
  const getBusinessLimit = () => criteria.limits?.maxBusinesses || criteria.businessLimit || 50
  const getMaxReviewsPerBusiness = () => criteria.limits?.maxReviewsPerBusiness || criteria.maxReviewsPerBusiness || 5
  const getMaxStars = () => criteria.reviewFilters?.maxStars || criteria.maxStars || 3
  const getDayLimit = () => criteria.reviewFilters?.dayLimit || criteria.dayLimit || 14

  const businessLimit = getBusinessLimit()
  const maxReviewsPerBusiness = getMaxReviewsPerBusiness()

  // ✅ Detect cache mode from prop or criteria
  const isCacheMode = useCached || criteria.useCached || false

  // ✅ Detect enrichment and review extraction
  const enrichmentEnabled = criteria.enrichment?.enabled || false
  const reviewsEnabled = criteria.reviewFilters?.enabled !== false // Default true for legacy

  // 🎯 DYNAMIC COST CALCULATION
  let estimatedCost = 0
  let costBreakdown = {
    businesses: 0,
    reviews: 0,
    enrichment: 0
  }

  if (isCacheMode) {
    // Cache mode: $0 cost
    estimatedCost = 0
  } else {
    // Business scraping cost
    const businessCost = enrichmentEnabled ? 0.009 : 0.004
    costBreakdown.businesses = businessLimit * businessCost

    // Review extraction cost (only if enabled)
    if (reviewsEnabled) {
      const estimatedReviewsTotal = businessLimit * maxReviewsPerBusiness
      costBreakdown.reviews = estimatedReviewsTotal * 0.02
    }

    // Total cost
    estimatedCost = costBreakdown.businesses + costBreakdown.reviews + costBreakdown.enrichment
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {isCacheMode ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                Load Cached Businesses
              </>
            ) : (
              <>
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                Confirm Extraction Parameters
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isCacheMode
              ? 'Verify these search parameters. Businesses will be loaded instantly from cache at no cost.'
              : 'Please verify these search parameters before starting the extraction. This will prevent incorrect searches and wasted API credits.'
            }
          </DialogDescription>
        </DialogHeader>

        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="pt-6 space-y-4">
            {/* Category */}
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Business Category</p>
                <p className="text-lg font-semibold text-foreground">{criteria.category}</p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Target Location</p>
                <p className="text-lg font-semibold text-foreground">{criteria.location}</p>
              </div>
            </div>

            {/* Max Review Stars */}
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Maximum Review Rating</p>
                <p className="text-lg font-semibold text-foreground">
                  ≤ {getMaxStars()} stars
                </p>
              </div>
            </div>

            {/* Time Window */}
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Time Window</p>
                <p className="text-lg font-semibold text-foreground">
                  Last {getDayLimit()} days
                </p>
              </div>
            </div>

            {/* Business Limit */}
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Business Limit</p>
                <p className="text-lg font-semibold text-foreground">
                  {businessLimit} businesses
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Up to {getMaxReviewsPerBusiness()} reviews per business
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Estimate - Different for Cache vs Scraping */}
        {isCacheMode ? (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Cache Mode: Instant Load, $0 Cost
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Loading from cached data. No API calls will be made.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Estimated Cost: ${estimatedCost.toFixed(2)}
                  </p>
                  <div className="text-sm text-amber-700 dark:text-amber-300 mt-2 space-y-1">
                    <div>• Businesses: ${costBreakdown.businesses.toFixed(2)} ({businessLimit} × ${enrichmentEnabled ? '0.009' : '0.004'})</div>
                    {reviewsEnabled && (
                      <div>• Reviews: ${costBreakdown.reviews.toFixed(2)} (up to {businessLimit * maxReviewsPerBusiness} × $0.02)</div>
                    )}
                    {!reviewsEnabled && (
                      <div className="text-green-600 dark:text-green-400">• Reviews: Disabled (saves ${(businessLimit * maxReviewsPerBusiness * 0.02).toFixed(2)})</div>
                    )}
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                    This will consume Apify API credits. Verify parameters are correct.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirmation Checklist */}
        <Card>
          <CardContent className="pt-6">
            <p className="font-medium mb-3">Before you proceed, verify:</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span>The business category is correct</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span>The location matches your target market</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span>The review filters meet your requirements</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="min-w-[120px]"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="min-w-[120px] bg-primary hover:bg-primary/90"
          >
            <Search className="h-4 w-4 mr-2" />
            Confirm & Start Extraction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
