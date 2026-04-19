'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Building2,
  RefreshCw,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Plus,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { AddToQueueModal } from '@/components/crawl-manager/add-to-queue-modal'

// Types
interface Business {
  id: string
  name: string
  place_id: string
  category: string
  city: string
  address: string
  rating: number
  reviews_count: number
  phone?: string
  website?: string
  google_maps_url: string
  last_crawled_at?: string
  days_since_crawl?: number
  reviews_in_last_crawl?: number
  next_recommended?: string
  crawl_status: 'never_crawled' | 'recent' | 'soon' | 'due' | 'overdue'
  in_queue: boolean
}

interface CrawlStats {
  totalBusinesses: number
  crawlStatus: {
    neverCrawled: number
    dueForRecrawl: number
    upToDate: number
    inQueue: number
  }
}

export default function CrawlManagerPage() {
  // State
  const [stats, setStats] = useState<CrawlStats | null>(null)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [totalBusinesses, setTotalBusinesses] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedBusinesses, setSelectedBusinesses] = useState<Set<string>>(new Set())
  const [showAddToQueueModal, setShowAddToQueueModal] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [cityFilter, setCityFilter] = useState<string>('')
  const [crawlStatusFilter, setCrawlStatusFilter] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage] = useState(50)

  // Load stats on mount
  useEffect(() => {
    loadStats()
    loadBusinesses()
  }, [crawlStatusFilter, categoryFilter, cityFilter, currentPage])

  const loadStats = async () => {
    try {
      const response = await fetch('/api/crawl/stats')
      const data = await response.json()
      if (data.success) {
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const loadBusinesses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (crawlStatusFilter) params.append('crawlStatus', crawlStatusFilter)
      if (categoryFilter) params.append('category', categoryFilter)
      if (cityFilter) params.append('city', cityFilter)
      params.append('limit', itemsPerPage.toString())
      params.append('offset', (currentPage * itemsPerPage).toString())

      const response = await fetch(`/api/crawl/businesses?${params}`)
      const data = await response.json()

      if (data.success) {
        setBusinesses(data.businesses)
        setTotalBusinesses(data.total)
      }
    } catch (error) {
      console.error('Failed to load businesses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectBusiness = (businessId: string) => {
    const newSelected = new Set(selectedBusinesses)
    if (newSelected.has(businessId)) {
      newSelected.delete(businessId)
    } else {
      newSelected.add(businessId)
    }
    setSelectedBusinesses(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedBusinesses.size === businesses.length) {
      setSelectedBusinesses(new Set())
    } else {
      setSelectedBusinesses(new Set(businesses.map(b => b.id)))
    }
  }

  const getCrawlStatusBadge = (status: string) => {
    const config = {
      never_crawled: { label: 'Never Crawled', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
      recent: { label: 'Recent', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
      soon: { label: 'Soon', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
      due: { label: 'Due', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
      overdue: { label: 'Overdue', color: 'bg-red-500/20 text-red-300 border-red-500/30' }
    }
    const { label, color } = config[status as keyof typeof config] || config.never_crawled
    return <span className={cn('px-2 py-1 rounded-full text-xs font-medium border', color)}>{label}</span>
  }

  const filteredBusinesses = businesses.filter(business => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      business.name.toLowerCase().includes(query) ||
      business.city.toLowerCase().includes(query) ||
      business.category.toLowerCase().includes(query)
    )
  })

  const totalPages = Math.ceil(totalBusinesses / itemsPerPage)

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
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <RefreshCw className="h-8 w-8 text-primary" />
                Review Scraper
              </h1>
              <p className="text-muted-foreground mt-1">
                Manually scrape Google reviews for {stats?.totalBusinesses.toLocaleString() || 0} businesses
              </p>
            </div>
          </div>
          <Button
            onClick={() => { loadStats(); loadBusinesses(); }}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-gray-500/10 to-gray-600/10 border-gray-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Never Crawled</p>
                  <p className="text-2xl font-bold text-gray-300">{stats.crawlStatus.neverCrawled.toLocaleString()}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-gray-400" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-xs"
                onClick={() => setCrawlStatusFilter('never_crawled')}
              >
                View All
              </Button>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-600/10 border-yellow-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Due for Re-crawl</p>
                  <p className="text-2xl font-bold text-yellow-300">{stats.crawlStatus.dueForRecrawl.toLocaleString()}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-xs"
                onClick={() => setCrawlStatusFilter('due')}
              >
                View All
              </Button>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-600/10 border-green-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Up to Date</p>
                  <p className="text-2xl font-bold text-green-300">{stats.crawlStatus.upToDate.toLocaleString()}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-xs"
                onClick={() => setCrawlStatusFilter('recent')}
              >
                View All
              </Button>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-600/10 border-blue-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Queue</p>
                  <p className="text-2xl font-bold text-blue-300">{stats.crawlStatus.inQueue.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-400" />
              </div>
              <Link href="/dashboard/crawl-queue">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full text-xs"
                >
                  View Queue
                </Button>
              </Link>
            </Card>
          </div>
        )}
      </motion.div>

      {/* Filters and Search */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search businesses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Button
            variant={crawlStatusFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCrawlStatusFilter(crawlStatusFilter ? '' : 'never_crawled')}
          >
            <Filter className="h-4 w-4 mr-2" />
            {crawlStatusFilter || 'All Status'}
          </Button>
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Quick filters:</span>
          <Button
            variant={crawlStatusFilter === 'never_crawled' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCrawlStatusFilter('never_crawled')}
          >
            Never Crawled
          </Button>
          <Button
            variant={crawlStatusFilter === 'due' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCrawlStatusFilter('due')}
          >
            Due
          </Button>
          <Button
            variant={crawlStatusFilter === 'overdue' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCrawlStatusFilter('overdue')}
          >
            Overdue
          </Button>
          {crawlStatusFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCrawlStatusFilter('')}
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Selection Bar */}
      {selectedBusinesses.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <Card className="p-4 bg-primary/10 border-primary/20">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {selectedBusinesses.size} business{selectedBusinesses.size !== 1 ? 'es' : ''} selected
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBusinesses(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowAddToQueueModal(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Queue Review Scrape
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Business Table */}
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Businesses ({totalBusinesses.toLocaleString()})
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
          >
            {selectedBusinesses.size === businesses.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={selectedBusinesses.size === businesses.length && businesses.length > 0}
                        onChange={handleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Business</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Location</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Rating</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Last Crawl</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBusinesses.map((business) => (
                    <tr key={business.id} className="border-b border-border/50 hover:bg-white/5">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedBusinesses.has(business.id)}
                          onChange={() => handleSelectBusiness(business.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{business.name}</p>
                          <p className="text-sm text-muted-foreground">{business.category}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="text-sm">{business.city}</p>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{business.rating.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({business.reviews_count})</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {business.last_crawled_at ? (
                          <div>
                            <p className="text-sm">{business.days_since_crawl} days ago</p>
                            <p className="text-xs text-muted-foreground">
                              {business.reviews_in_last_crawl} reviews
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </td>
                      <td className="p-3">
                        {getCrawlStatusBadge(business.crawl_status)}
                      </td>
                      <td className="p-3">
                        <Link href={`/dashboard/crawl-history/${business.id}`}>
                          <Button variant="ghost" size="sm">
                            View History
                          </Button>
                        </Link>
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
                  Showing {currentPage * itemsPerPage + 1} to {Math.min((currentPage + 1) * itemsPerPage, totalBusinesses)} of {totalBusinesses}
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
        )}
      </Card>

      {/* Add to Queue Modal */}
      <AddToQueueModal
        isOpen={showAddToQueueModal}
        onClose={() => setShowAddToQueueModal(false)}
        selectedBusinessIds={Array.from(selectedBusinesses)}
        onSuccess={() => {
          setSelectedBusinesses(new Set())
          loadStats()
          loadBusinesses()
        }}
      />
    </div>
  )
}
