'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Search,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Eye,
  AlertCircle,
  XCircle,
} from 'lucide-react'

interface Alert {
  id: string
  business_id: string
  business_name: string
  customer_tier: string
  review_id: string | null
  review_text: string | null
  reviewer_name: string | null
  review_rating: number | null
  review_date: string | null
  alert_type: string
  severity: string
  detected_at: string
  acknowledged_at: string | null
  acknowledged_by: string | null
  acknowledged_by_name: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolved_by_name: string | null
  action_taken: string | null
}

interface Stats {
  totalAlerts: number
  unacknowledged: number
  acknowledged: number
  resolved: number
  resolvedToday: number
  criticalAlerts: number
  highAlerts: number
  mediumAlerts: number
  lowAlerts: number
}

export default function MonitoringAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [stats, setStats] = useState<Stats>({
    totalAlerts: 0,
    unacknowledged: 0,
    acknowledged: 0,
    resolved: 0,
    resolvedToday: 0,
    criticalAlerts: 0,
    highAlerts: 0,
    mediumAlerts: 0,
    lowAlerts: 0,
  })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'detected_at', desc: true },
  ])
  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [actionTaken, setActionTaken] = useState('')
  const [processing, setProcessing] = useState(false)

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: '50',
        offset: '0',
        severity: severityFilter,
        status: statusFilter,
        ...(searchTerm && { search: searchTerm }),
      })

      const response = await fetch(`/api/monitoring/alerts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch alerts')

      const data = await response.json()
      setAlerts(data.alerts || [])
      setStats(data.stats || stats)
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [severityFilter, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAlerts()
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4" />
      case 'high':
        return <AlertTriangle className="h-4 w-4" />
      case 'medium':
        return <AlertCircle className="h-4 w-4" />
      case 'low':
        return <Bell className="h-4 w-4" />
      default:
        return null
    }
  }

  const handleAction = async (alert: Alert, action: 'acknowledge' | 'resolve') => {
    try {
      setProcessing(true)
      const response = await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: alert.id,
          action,
          actionTaken,
        }),
      })

      if (!response.ok) throw new Error('Failed to update alert')

      setSelectedAlert(null)
      setActionTaken('')
      fetchAlerts()
    } catch (error) {
      console.error('Error updating alert:', error)
    } finally {
      setProcessing(false)
    }
  }

  const columns = useMemo<ColumnDef<Alert>[]>(
    () => [
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ row }) => {
          const severity = row.original.severity
          return (
            <Badge className={`gap-1 ${getSeverityColor(severity)}`}>
              {getSeverityIcon(severity)}
              {severity}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'business_name',
        header: 'Business',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.business_name}</div>
            <Badge variant="outline" className="text-xs mt-1">
              {row.original.customer_tier}
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: 'review',
        header: 'Review',
        cell: ({ row }) => {
          const rating = row.original.review_rating
          const text = row.original.review_text
          return (
            <div className="max-w-xs">
              {rating && (
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-sm font-medium">{rating} ⭐</span>
                </div>
              )}
              {text && (
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {text}
                </p>
              )}
              {row.original.reviewer_name && (
                <p className="text-xs text-gray-500 mt-1">
                  - {row.original.reviewer_name}
                </p>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'detected_at',
        header: 'Detected',
        cell: ({ row }) => {
          const date = new Date(row.original.detected_at)
          const hours = Math.floor(
            (new Date().getTime() - date.getTime()) / (1000 * 60 * 60)
          )
          return (
            <div>
              <div className="text-sm">{date.toLocaleDateString()}</div>
              <div className="text-xs text-gray-500">
                {hours < 1 ? 'Just now' : `${hours}h ago`}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const alert = row.original
          if (alert.resolved_at) {
            return (
              <Badge variant="outline" className="gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Resolved
              </Badge>
            )
          } else if (alert.acknowledged_at) {
            return (
              <Badge variant="outline" className="gap-1 text-blue-600">
                <Clock className="h-3 w-3" />
                Acknowledged
              </Badge>
            )
          } else {
            return (
              <Badge variant="destructive" className="gap-1">
                <Bell className="h-3 w-3" />
                New
              </Badge>
            )
          }
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setSelectedAlert(row.original)}
          >
            <Eye className="h-3 w-3" />
            View
          </Button>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: alerts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoring Alerts</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Review and manage customer monitoring alerts
          </p>
        </div>
        <Link href="/dashboard/monitoring/stats">
          <Button variant="outline">View Stats</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Alerts</p>
              <p className="text-2xl font-bold">{stats.totalAlerts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unacknowledged</p>
              <p className="text-2xl font-bold">{stats.unacknowledged}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Acknowledged</p>
              <p className="text-2xl font-bold">{stats.acknowledged}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Resolved</p>
              <p className="text-2xl font-bold">{stats.resolved}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <XCircle className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Critical</p>
              <p className="text-2xl font-bold">{stats.criticalAlerts}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by business name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="unacknowledged">Unacknowledged</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8">
                  No alerts found
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Alert Detail Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Alert Details</DialogTitle>
            <DialogDescription>
              Review alert information and take action
            </DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-4">
              {/* Business Info */}
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Business</h3>
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">Name:</span> {selectedAlert.business_name}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Tier:</span>{' '}
                    <Badge variant="outline">{selectedAlert.customer_tier}</Badge>
                  </p>
                  <Link href={`/dashboard/customers/${selectedAlert.business_id}`}>
                    <Button size="sm" variant="link" className="p-0 h-auto">
                      View Customer Profile →
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Review Info */}
              {selectedAlert.review_text && (
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Review</h3>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Rating:</span> {selectedAlert.review_rating} ⭐
                    </p>
                    {selectedAlert.reviewer_name && (
                      <p className="text-sm">
                        <span className="font-medium">Reviewer:</span> {selectedAlert.reviewer_name}
                      </p>
                    )}
                    <p className="text-sm">
                      <span className="font-medium">Date:</span>{' '}
                      {selectedAlert.review_date
                        ? new Date(selectedAlert.review_date).toLocaleDateString()
                        : 'Unknown'}
                    </p>
                    <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded border">
                      <p className="text-sm">{selectedAlert.review_text}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Alert Info */}
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Alert Information</h3>
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">Severity:</span>{' '}
                    <Badge className={getSeverityColor(selectedAlert.severity)}>
                      {selectedAlert.severity}
                    </Badge>
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Detected:</span>{' '}
                    {new Date(selectedAlert.detected_at).toLocaleString()}
                  </p>
                  {selectedAlert.acknowledged_at && (
                    <p className="text-sm">
                      <span className="font-medium">Acknowledged:</span>{' '}
                      {new Date(selectedAlert.acknowledged_at).toLocaleString()}
                      {selectedAlert.acknowledged_by_name &&
                        ` by ${selectedAlert.acknowledged_by_name}`}
                    </p>
                  )}
                  {selectedAlert.resolved_at && (
                    <p className="text-sm">
                      <span className="font-medium">Resolved:</span>{' '}
                      {new Date(selectedAlert.resolved_at).toLocaleString()}
                      {selectedAlert.resolved_by_name &&
                        ` by ${selectedAlert.resolved_by_name}`}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Section */}
              {!selectedAlert.resolved_at && (
                <div className="space-y-3">
                  <Label htmlFor="action_taken">Action Taken (Optional)</Label>
                  <Textarea
                    id="action_taken"
                    placeholder="Describe what action was taken..."
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    rows={3}
                  />

                  <div className="flex gap-2">
                    {!selectedAlert.acknowledged_at && (
                      <Button
                        onClick={() => handleAction(selectedAlert, 'acknowledge')}
                        disabled={processing}
                        variant="outline"
                        className="flex-1"
                      >
                        {processing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Clock className="h-4 w-4 mr-2" />
                        )}
                        Acknowledge
                      </Button>
                    )}
                    <Button
                      onClick={() => handleAction(selectedAlert, 'resolve')}
                      disabled={processing}
                      className="flex-1"
                    >
                      {processing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Resolve
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
