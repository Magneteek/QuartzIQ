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
}

interface ExtractionConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  criteria: SearchCriteria | null
}

export function ExtractionConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  criteria
}: ExtractionConfirmationModalProps) {
  if (!criteria) return null

  const estimatedCost = Math.ceil((criteria.businessLimit || 50) / 50) * 5 // Rough $5 per 50 businesses

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Confirm Extraction Parameters
          </DialogTitle>
          <DialogDescription>
            Please verify these search parameters before starting the extraction. This will prevent incorrect searches and wasted API credits.
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
                  ≤ {criteria.maxStars || 3} stars
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
                  Last {criteria.dayLimit || 14} days
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
                  {criteria.businessLimit || 50} businesses
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Up to {criteria.maxReviewsPerBusiness || 5} reviews per business
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Estimate */}
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  Estimated Cost: ~${estimatedCost}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  This extraction will consume Apify API credits. Make sure these parameters are correct.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
