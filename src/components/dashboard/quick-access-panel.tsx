'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Target,
  TrendingDown,
  ArrowRight,
  Star,
  Building,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface QuickStats {
  qualifiedReviews: number
  averageRating: string
  uniqueBusinesses: number
  crawlableBusinesses: number
}

export function QuickAccessPanel() {
  const [stats, setStats] = useState<QuickStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    setLoading(true)
    try {
      // Fetch qualified reviews stats
      const reviewsResponse = await fetch('/api/qualified-reviews?limit=1000')
      const reviewsData = await reviewsResponse.json()

      // Fetch crawl targets stats
      const targetsResponse = await fetch('/api/crawl/targets?mode=primary&limit=1')
      const targetsData = await targetsResponse.json()

      setStats({
        qualifiedReviews: reviewsData.statistics?.totalReviews || 0,
        averageRating: reviewsData.statistics?.averageRating || '0',
        uniqueBusinesses: reviewsData.statistics?.uniqueBusinesses || 0,
        crawlableBusinesses: targetsData.statistics?.total_with_reviews || 0
      })
    } catch (error) {
      console.error('Failed to fetch quick stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Qualified Reviews Card */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20 hover:border-orange-500/40 transition-colors">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <TrendingDown className="h-6 w-6 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Qualified Lead Reviews</h3>
                  <p className="text-sm text-muted-foreground">
                    Low-star reviews from competitors
                  </p>
                </div>
              </div>
              <Link href="/dashboard/qualified-reviews">
                <Button size="sm" variant="ghost" className="text-orange-400 hover:text-orange-300">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-5 w-5 animate-spin text-orange-400" />
              </div>
            ) : stats ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-400">
                    {stats.qualifiedReviews}
                  </div>
                  <div className="text-xs text-muted-foreground">Reviews</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-400 flex items-center justify-center">
                    <Star className="h-5 w-5 fill-current mr-1" />
                    {stats.averageRating}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Rating</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-400">
                    {stats.uniqueBusinesses}
                  </div>
                  <div className="text-xs text-muted-foreground">Businesses</div>
                </div>
              </div>
            ) : null}

            <Link href="/dashboard/qualified-reviews">
              <Button className="w-full bg-orange-500 hover:bg-orange-600">
                View All Qualified Reviews
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>

      {/* Crawl Targets Card */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-primary/10 border-primary/20 hover:border-primary/40 transition-colors">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Smart Crawl Targets</h3>
                  <p className="text-sm text-muted-foreground">
                    Businesses ready for review extraction
                  </p>
                </div>
              </div>
              <Link href="/dashboard/crawl-targets">
                <Button size="sm" variant="ghost" className="text-primary hover:text-primary/80">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : stats ? (
              <div className="text-center py-2">
                <div className="text-3xl font-bold text-primary">
                  {stats.crawlableBusinesses}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Businesses with reviews available for crawling
                </div>
              </div>
            ) : null}

            <Link href="/dashboard/crawl-targets">
              <Button className="w-full bg-primary hover:bg-primary/90">
                Start Crawling Reviews
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
