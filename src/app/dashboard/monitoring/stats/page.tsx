'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Users,
  Bell,
  DollarSign,
  Clock,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  Activity,
} from 'lucide-react'

interface Stats {
  totalCustomers: number
  activeMonitoring: number
  totalChecks: number
  totalAlertsCreated: number
  totalReviewsScanned: number
  totalCostUsd: number
  averageCheckDurationMs: number
  successRate: number
  checksLast24h: number
  alertsLast24h: number
}

interface HistoryItem {
  id: string
  business_id: string
  business_name: string
  checked_at: string
  reviews_found: number
  negative_reviews_found: number
  alerts_created: number
  scrape_cost_usd: number
  scrape_duration_ms: number
  status: string
}

interface UpcomingCheck {
  id: string
  business_name: string
  customer_tier: string
  next_monitoring_check: string
  monitoring_frequency_hours: number
}

export default function MonitoringStatsPage() {
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    activeMonitoring: 0,
    totalChecks: 0,
    totalAlertsCreated: 0,
    totalReviewsScanned: 0,
    totalCostUsd: 0,
    averageCheckDurationMs: 0,
    successRate: 0,
    checksLast24h: 0,
    alertsLast24h: 0,
  })
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([])
  const [upcomingChecks, setUpcomingChecks] = useState<UpcomingCheck[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/monitoring/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')

      const data = await response.json()
      setStats(data.stats || stats)
      setRecentHistory(data.recentHistory || [])
      setUpcomingChecks(data.upcomingChecks || [])
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const getTimeUntil = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (diff < 0) return 'Overdue'
    if (hours < 1) return `${minutes}m`
    if (hours < 24) return `${hours}h ${minutes}m`
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoring Statistics</h1>
          <p className="text-gray-600 dark:text-gray-400">
            System-wide monitoring performance and activity
          </p>
        </div>
        <Link href="/dashboard/monitoring">
          <Button variant="outline">View Alerts</Button>
        </Link>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Customers</p>
              <p className="text-2xl font-bold">{stats.totalCustomers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Activity className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
              <p className="text-2xl font-bold">{stats.activeMonitoring}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Checks</p>
              <p className="text-2xl font-bold">{stats.totalChecks}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Bell className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Alerts Created</p>
              <p className="text-2xl font-bold">{stats.totalAlertsCreated}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <DollarSign className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Cost</p>
              <p className="text-2xl font-bold">${stats.totalCostUsd.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold">Avg Duration</h3>
          </div>
          <p className="text-2xl font-bold">{formatDuration(stats.averageCheckDurationMs)}</p>
          <p className="text-sm text-gray-500 mt-1">Per check</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold">Success Rate</h3>
          </div>
          <p className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</p>
          <p className="text-sm text-gray-500 mt-1">All time</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold">Checks (24h)</h3>
          </div>
          <p className="text-2xl font-bold">{stats.checksLast24h}</p>
          <p className="text-sm text-gray-500 mt-1">Last 24 hours</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3 mb-3">
            <Bell className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold">Alerts (24h)</h3>
          </div>
          <p className="text-2xl font-bold">{stats.alertsLast24h}</p>
          <p className="text-sm text-gray-500 mt-1">Last 24 hours</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Monitoring Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold">Recent Monitoring Activity</h2>
          </div>
          <div className="p-4">
            {recentHistory.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No monitoring history yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Reviews</TableHead>
                    <TableHead>Alerts</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/customers/${item.business_id}`}
                          className="hover:underline"
                        >
                          {item.business_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(item.checked_at).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {item.reviews_found} ({item.negative_reviews_found} neg)
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.alerts_created > 0 ? (
                          <Badge variant="destructive">{item.alerts_created}</Badge>
                        ) : (
                          <span className="text-sm text-gray-500">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.status === 'success' ? (
                          <Badge variant="outline" className="gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-red-600">
                            <XCircle className="h-3 w-3" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Upcoming Checks */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold">Upcoming Checks</h2>
          </div>
          <div className="p-4">
            {upcomingChecks.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No upcoming checks scheduled</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next Check</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingChecks.map((check) => (
                    <TableRow key={check.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/customers/${check.id}`}
                          className="hover:underline"
                        >
                          {check.business_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{check.customer_tier}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        Every {check.monitoring_frequency_hours}h
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getTimeUntil(check.next_monitoring_check)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
