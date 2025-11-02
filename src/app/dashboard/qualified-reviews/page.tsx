'use client'

import { QualifiedReviewsPanel } from '@/components/reviews/qualified-reviews-panel'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Target, TrendingDown } from 'lucide-react'
import Link from 'next/link'

export default function QualifiedReviewsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-card p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-orange-400" />
              Qualified Lead Reviews
            </h1>
            <p className="text-muted-foreground mt-2">
              Low-star reviews from competitors - potential leads for your business
            </p>
          </div>
          <Link href="/dashboard/crawl-targets">
            <Button className="bg-primary">
              <Target className="h-4 w-4 mr-2" />
              Crawl More Businesses
            </Button>
          </Link>
        </div>

        {/* Qualified Reviews Panel */}
        <QualifiedReviewsPanel />
      </div>
    </div>
  )
}
