'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  History,
  TrendingUp,
  DollarSign,
  Calendar,
  Building2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Star,
  ArrowLeft,
  Search,
  Filter,
  BarChart3
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// Types
interface CrawlRecord {
  id: string
  business_id: string
  business_name: string
  city: string | null
  category: string | null
  crawled_at: string
  crawl_duration_seconds: number | null
  reviews_found: number
  reviews_new: number
  is_incremental: boolean
  apify_cost_usd: number
  status: string
  error_message: string | null
}

interface CrawlStats {
  totalCrawls: number
  totalBusinesses: number
  totalReviews: number
  totalCost: number
  avgReviewsPerCrawl: number
  incrementalCrawls: number
  avgCostPerBusiness: number
}

export default function CrawlHistoryPage() {
  const [crawlRecords, setCrawlRecords] = useState<CrawlRecord[]>([])
  const [stats, setStats] = useState<CrawlStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<'date' | 'cost' | 'reviews'>('date')
  const [currentPage, setCurrentPage] = useState(0)
  const itemsPerPage = 50

  const loadHistory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (statusFilter) params.set('status', statusFilter)
      params.set('sortBy', sortBy)

      const res = await fetch(`/api/crawl/history?${params}`)
      const data = await res.json()

      if (data.success) {
        setCrawlRecords(data.records)
        setStats({
          totalCrawls: data.stats.total_crawls,
          totalBusinesses: data.stats.total_businesses,
          totalReviews: data.stats.total_reviews,
          totalCost: parseFloat(data.stats.total_cost),
          avgReviewsPerCrawl: parseFloat(data.stats.avg_reviews_per_crawl),
          incrementalCrawls: data.stats.incremental_crawls,
          avgCostPerBusiness: parseFloat(data.stats.avg_cost_per_business),
        })
      }
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  // Filter and sort records
  const filteredRecords = crawlRecords
    .filter(record => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return record.business_name.toLowerCase().includes(query)
      }
      return true
    })
    .filter(record => {
      if (statusFilter) {
        return record.status === statusFilter
      }
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.crawled_at).getTime() - new Date(a.crawled_at).getTime()
        case 'cost':
          return b.apify_cost_usd - a.apify_cost_usd
        case 'reviews':
          return b.reviews_found - a.reviews_found
        default:
          return 0
      }
    })

  const paginatedRecords = filteredRecords.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  )

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/crawl-manager">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Manager
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <History className="h-8 w-8 text-primary" />
                Crawl History & Analytics
              </h1>
              <p className="text-muted-foreground mt-1">
                Complete history of all review crawling operations
              </p>
            </div>
          </div>
          <Button
            onClick={loadHistory}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Statistics Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-600/10 border-blue-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Crawls</p>
                  <p className="text-2xl font-bold text-blue-300">{stats.totalCrawls}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.totalBusinesses} businesses
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-400" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-600/10 border-green-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Reviews</p>
                  <p className="text-2xl font-bold text-green-300">{stats.totalReviews}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.avgReviewsPerCrawl.toFixed(1)} avg/crawl
                  </p>
                </div>
                <Star className="h-8 w-8 text-green-400" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-600/10 border-yellow-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold text-yellow-300">
                    ${stats.totalCost.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${stats.avgCostPerBusiness.toFixed(4)}/business
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-400" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-600/10 border-purple-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Incremental</p>
                  <p className="text-2xl font-bold text-purple-300">
                    {stats.incrementalCrawls}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.totalCrawls > 0
                      ? ((stats.incrementalCrawls / stats.totalCrawls) * 100).toFixed(1)
                      : 0}% of total
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-400" />
              </div>
            </Card>
          </div>
        )}
      </motion.div>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by business name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort:</span>
            <Button
              variant={sortBy === 'date' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('date')}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Date
            </Button>
            <Button
              variant={sortBy === 'cost' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('cost')}
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Cost
            </Button>
            <Button
              variant={sortBy === 'reviews' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('reviews')}
            >
              <Star className="h-4 w-4 mr-1" />
              Reviews
            </Button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="partial">Partial</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Crawl History Table */}
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Crawl Records ({filteredRecords.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : paginatedRecords.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Business</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Crawled At</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Duration</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Reviews</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Cost</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Next Crawl</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record) => (
                    <tr key={record.id} className="border-b border-border/50 hover:bg-white/5">
                      <td className="p-3">
                        <div className="font-medium">{record.business_name}</div>
                        {record.city && <div className="text-xs text-muted-foreground">{record.city}</div>}
                      </td>
                      <td className="p-3 text-sm">
                        {formatDate(record.crawled_at)}
                      </td>
                      <td className="p-3 text-sm">
                        {formatDuration(record.crawl_duration_seconds)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{record.reviews_found}</span>
                          {record.reviews_new > 0 && (
                            <span className="text-xs text-green-400">
                              +{record.reviews_new} new
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm">
                        ${Number(record.apify_cost_usd || 0).toFixed(4)}
                      </td>
                      <td className="p-3">
                        <span className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          record.is_incremental
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                        )}>
                          {record.is_incremental ? 'Incremental' : 'Full'}
                        </span>
                      </td>
                      <td className="p-3">
                        {record.status === 'completed' ? (
                          <span className="flex items-center gap-1 text-green-300">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs">Complete</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-300" title={record.error_message || ''}>
                            <XCircle className="h-4 w-4" />
                            <span className="text-xs">Failed</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {currentPage * itemsPerPage + 1} to{' '}
                  {Math.min((currentPage + 1) * itemsPerPage, filteredRecords.length)} of{' '}
                  {filteredRecords.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage === totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-12 text-center">
            <History className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Crawl History</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter
                ? 'No records match your filters'
                : 'Start crawling businesses to see history here'}
            </p>
            {!searchQuery && !statusFilter && (
              <Link href="/dashboard/crawl-manager">
                <Button variant="default">
                  Go to Crawl Manager
                </Button>
              </Link>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
