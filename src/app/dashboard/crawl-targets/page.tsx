'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Target,
  Star,
  MapPin,
  Clock,
  RefreshCw,
  Download,
  Filter,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Eye,
} from 'lucide-react'

interface CrawlTarget {
  place_id: string
  name: string
  category: string
  city: string
  address: string
  reviews_count: number
  rating: number
  crawl_priority: string
  last_scraped_at: string | null
  scrape_count: number
  days_since_crawl: number
  crawl_status?: string
  last_review_check_at?: string | null
  review_check_count?: number
  days_since_check?: number
  check_status?: string
}

interface CrawlStats {
  total_with_reviews?: string
  never_crawled?: string
  stale?: string
  high_priority?: string
  medium_priority?: string
  standard_priority?: string
  total_zero_reviews?: string
  never_checked?: string
  ready_for_check?: string
  overdue_check?: string
  avg_check_count?: string
}

export default function CrawlTargetsPage() {
  const [mode, setMode] = useState<'primary' | 'secondary'>('primary')
  const [targets, setTargets] = useState<CrawlTarget[]>([])
  const [stats, setStats] = useState<CrawlStats>({})
  const [loading, setLoading] = useState(true)
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set())

  // Filters
  const [limit, setLimit] = useState(50)
  const [category, setCategory] = useState<string>('')
  const [city, setCity] = useState<string>('')
  const [priority, setPriority] = useState<string>('')
  const [maxReviews, setMaxReviews] = useState(3)

  // Crawl state
  const [isCrawling, setIsCrawling] = useState(false)
  const [crawlProgress, setCrawlProgress] = useState(0)
  const [crawlStep, setCrawlStep] = useState('')
  const [crawlResults, setCrawlResults] = useState<any>(null)

  const fetchTargets = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        mode,
        limit: limit.toString(),
        ...(category && { category }),
        ...(city && { city }),
        ...(priority && { priority }),
      })

      const response = await fetch(`/api/crawl/targets?${params}`)
      const data = await response.json()

      if (data.success) {
        setTargets(data.targets)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch targets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTargets()
  }, [mode, limit, category, city, priority])

  const toggleTarget = (placeId: string) => {
    const newSelected = new Set(selectedTargets)
    if (newSelected.has(placeId)) {
      newSelected.delete(placeId)
    } else {
      newSelected.add(placeId)
    }
    setSelectedTargets(newSelected)
  }

  const selectAll = () => {
    setSelectedTargets(new Set(targets.map(t => t.place_id)))
  }

  const clearSelection = () => {
    setSelectedTargets(new Set())
  }

  const exportTargets = () => {
    const selectedData = targets.filter(t => selectedTargets.has(t.place_id))
    const csv = [
      ['Place ID', 'Name', 'Category', 'City', 'Reviews', 'Rating', 'Priority'].join(','),
      ...selectedData.map(t =>
        [
          t.place_id,
          `"${t.name}"`,
          t.category,
          t.city,
          t.reviews_count,
          t.rating,
          t.crawl_priority,
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `crawl-targets-${mode}-${Date.now()}.csv`
    a.click()
  }

  const startCrawl = async () => {
    if (selectedTargets.size === 0) return

    setIsCrawling(true)
    setCrawlProgress(0)
    setCrawlStep('Initializing crawl...')
    setCrawlResults(null)

    try {
      const placeIds = Array.from(selectedTargets)

      const response = await fetch('/api/crawl/bulk-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeIds, mode, maxReviews })
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No reader available')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const update = JSON.parse(line)

            if (update.type === 'progress') {
              setCrawlProgress(update.progress || 0)
              setCrawlStep(update.step || '')
            } else if (update.type === 'result') {
              setCrawlResults(update.results)
              setCrawlProgress(100)
              setCrawlStep('Crawl completed!')

              // Refresh targets after crawl
              setTimeout(() => {
                fetchTargets()
                clearSelection()
              }, 2000)
            } else if (update.type === 'error') {
              throw new Error(update.error || 'Unknown error')
            }
          } catch (err) {
            console.error('Failed to parse crawl update', err)
          }
        }
      }
    } catch (error) {
      console.error('Crawl failed:', error)
      setCrawlStep(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setTimeout(() => {
        setIsCrawling(false)
        setCrawlProgress(0)
      }, 3000)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/40'
      case 'medium': return 'bg-orange-500/20 text-orange-400 border-orange-500/40'
      case 'standard': return 'bg-blue-500/20 text-blue-400 border-blue-500/40'
      case 'low': return 'bg-gray-500/20 text-gray-400 border-gray-500/40'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/40'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'never_crawled':
      case 'never_checked':
        return 'bg-green-500/20 text-green-400 border-green-500/40'
      case 'stale':
      case 'overdue':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40'
      case 'aging':
      case 'ready':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
      case 'fresh':
      case 'recent':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/40'
    }
  }

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          Smart Crawl Targets
        </h1>
        <p className="text-muted-foreground">
          Two-tier crawling system: Primary (guaranteed reviews) & Secondary (periodic checks)
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {mode === 'primary' ? (
          <>
            <StatsCard
              title="Total with Reviews"
              value={parseInt(stats.total_with_reviews || '0').toLocaleString()}
              icon={<CheckCircle className="h-5 w-5" />}
              color="text-green-400"
            />
            <StatsCard
              title="Never Crawled"
              value={parseInt(stats.never_crawled || '0').toLocaleString()}
              icon={<Sparkles className="h-5 w-5" />}
              color="text-blue-400"
            />
            <StatsCard
              title="High Priority"
              value={parseInt(stats.high_priority || '0').toLocaleString()}
              icon={<TrendingUp className="h-5 w-5" />}
              color="text-red-400"
            />
            <StatsCard
              title="Medium Priority"
              value={parseInt(stats.medium_priority || '0').toLocaleString()}
              icon={<Target className="h-5 w-5" />}
              color="text-orange-400"
            />
          </>
        ) : (
          <>
            <StatsCard
              title="Zero Reviews"
              value={parseInt(stats.total_zero_reviews || '0').toLocaleString()}
              icon={<Eye className="h-5 w-5" />}
              color="text-gray-400"
            />
            <StatsCard
              title="Ready for Check"
              value={parseInt(stats.ready_for_check || '0').toLocaleString()}
              icon={<RefreshCw className="h-5 w-5" />}
              color="text-blue-400"
            />
            <StatsCard
              title="Overdue Check"
              value={parseInt(stats.overdue_check || '0').toLocaleString()}
              icon={<AlertCircle className="h-5 w-5" />}
              color="text-orange-400"
            />
            <StatsCard
              title="Avg Checks"
              value={parseFloat(stats.avg_check_count || '0').toFixed(1)}
              icon={<Clock className="h-5 w-5" />}
              color="text-purple-400"
            />
          </>
        )}
      </div>

      {/* Mode Tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'primary' | 'secondary')}>
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="primary">
            Primary Crawl
            <Badge variant="outline" className="ml-2 bg-green-500/20 text-green-400">
              {parseInt(stats.total_with_reviews || '0').toLocaleString()}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="secondary">
            Secondary Check
            <Badge variant="outline" className="ml-2 bg-orange-500/20 text-orange-400">
              {parseInt(stats.ready_for_check || '0').toLocaleString()}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={mode} className="space-y-4">
          {/* Filters & Actions */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Limit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 results</SelectItem>
                  <SelectItem value="25">25 results</SelectItem>
                  <SelectItem value="50">50 results</SelectItem>
                  <SelectItem value="100">100 results</SelectItem>
                  <SelectItem value="200">200 results</SelectItem>
                </SelectContent>
              </Select>

              {mode === 'primary' && (
                <Select value={priority || 'all'} onValueChange={(v) => setPriority(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All priorities</SelectItem>
                    <SelectItem value="high">High priority</SelectItem>
                    <SelectItem value="medium">Medium priority</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="low">Low priority</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Max Reviews:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxReviews}
                  onChange={(e) => setMaxReviews(parseInt(e.target.value) || 3)}
                  className="w-20 px-2 py-1 text-sm border rounded-md bg-background"
                />
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectedTargets.size > 0 ? clearSelection : selectAll}
                >
                  {selectedTargets.size > 0 ? 'Clear All' : 'Select All'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportTargets}
                  disabled={selectedTargets.size === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export ({selectedTargets.size})
                </Button>
                <Button
                  size="sm"
                  onClick={startCrawl}
                  disabled={selectedTargets.size === 0 || isCrawling}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Target className="h-4 w-4 mr-2" />
                  {isCrawling ? 'Crawling...' : `Start Crawl (${selectedTargets.size})`}
                </Button>
                <Button size="sm" onClick={fetchTargets} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </Card>

          {/* Targets List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : targets.length === 0 ? (
            <Card className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No targets found</h3>
              <p className="text-muted-foreground">
                {mode === 'secondary'
                  ? 'No 0-review businesses are ready for checking yet. Check again in 30 days.'
                  : 'Try adjusting your filters or check back later.'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {targets.map((target, index) => (
                <motion.div
                  key={target.place_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                      selectedTargets.has(target.place_id) ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                    onClick={() => toggleTarget(target.place_id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Business Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedTargets.has(target.place_id)}
                            onChange={() => toggleTarget(target.place_id)}
                            className="mt-1"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{target.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3" />
                              {target.city} • {target.category}
                            </div>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex flex-wrap items-center gap-3 ml-8">
                          {mode === 'primary' && (
                            <>
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-yellow-400 fill-current" />
                                <span className="text-sm font-medium">
                                  {target.rating ? parseFloat(String(target.rating)).toFixed(1) : 'N/A'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({target.reviews_count?.toLocaleString()} reviews)
                                </span>
                              </div>
                              {target.days_since_crawl !== null && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {target.days_since_crawl === 0
                                    ? 'Never crawled'
                                    : `${target.days_since_crawl}d ago`}
                                </Badge>
                              )}
                            </>
                          )}
                          {mode === 'secondary' && (
                            <>
                              <Badge variant="outline" className="text-xs">
                                Checks: {target.review_check_count || 0}
                              </Badge>
                              {target.days_since_check !== null && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {target.review_check_count === 0
                                    ? 'Never checked'
                                    : `${target.days_since_check}d since check`}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-col items-end gap-2">
                        {target.crawl_priority && (
                          <Badge className={getPriorityColor(target.crawl_priority)}>
                            {target.crawl_priority}
                          </Badge>
                        )}
                        {(target.crawl_status || target.check_status) && (
                          <Badge className={getStatusColor(target.crawl_status || target.check_status || '')}>
                            {target.crawl_status || target.check_status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Crawl Progress Modal */}
      {isCrawling && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-4 right-4 w-96 z-50"
        >
          <Card className="p-6 shadow-2xl border-primary/50 bg-card/95 backdrop-blur">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary animate-pulse" />
                  Crawling Reviews
                </h3>
                <span className="text-sm font-medium text-primary">{crawlProgress}%</span>
              </div>

              <div className="space-y-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${crawlProgress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{crawlStep}</p>
              </div>

              {crawlResults && (
                <div className="pt-4 border-t space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Businesses:</span>
                    <span className="font-medium">{crawlResults.total}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-400">✓ Successful:</span>
                    <span className="font-medium text-green-400">{crawlResults.successful}</span>
                  </div>
                  {crawlResults.failed > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-red-400">✗ Failed:</span>
                      <span className="font-medium text-red-400">{crawlResults.failed}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Reviews Extracted:</span>
                    <span className="font-medium">
                      {crawlResults.details?.reduce((sum: number, r: any) => sum + (r.reviewsExtracted || 0), 0) || 0}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

function StatsCard({ title, value, icon, color }: {
  title: string
  value: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={color}>{icon}</div>
      </div>
    </Card>
  )
}
