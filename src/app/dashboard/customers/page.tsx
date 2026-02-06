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
import { Badge } from '@/components/ui/badge'
import {
  ArrowUpDown,
  Search,
  Star,
  Bell,
  BellOff,
  Eye,
  Users,
  TrendingUp,
  CheckCircle2,
  Loader2,
  Shield,
  Award,
  Zap,
} from 'lucide-react'

interface Customer {
  id: string
  business_name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  country: string | null
  rating: string
  total_reviews: number
  customer_tier: string
  customer_since: string
  monitoring_enabled: boolean
  monitoring_frequency_hours: number
  total_removed_reviews: number
  review_count: number
  unacknowledged_alerts: number
  latest_alert_date: string | null
}

interface Stats {
  totalCustomers: number
  basicTier: number
  premiumTier: number
  enterpriseTier: number
  monitoringEnabled: number
  newThisMonth: number
  totalRemovals: number
  avgRating: number
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    basicTier: 0,
    premiumTier: 0,
    enterpriseTier: 0,
    monitoringEnabled: 0,
    newThisMonth: 0,
    totalRemovals: 0,
    avgRating: 0,
  })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'customer_since', desc: true },
  ])
  const [searchTerm, setSearchTerm] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [monitoringFilter, setMonitoringFilter] = useState('all')

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const sortBy = sorting[0]?.id || 'customer_since'
      const sortOrder = sorting[0]?.desc ? 'DESC' : 'ASC'

      const params = new URLSearchParams({
        limit: '50',
        offset: '0',
        sortBy,
        sortOrder,
        tier: tierFilter,
        monitoring: monitoringFilter,
        ...(searchTerm && { search: searchTerm }),
      })

      const response = await fetch(`/api/customers?${params}`)
      if (!response.ok) throw new Error('Failed to fetch customers')

      const data = await response.json()
      setCustomers(data.customers || [])
      setStats(data.stats || stats)
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [sorting, tierFilter, monitoringFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers()
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return <Award className="h-4 w-4 text-purple-600" />
      case 'premium':
        return <Zap className="h-4 w-4 text-blue-600" />
      case 'basic':
        return <Shield className="h-4 w-4 text-gray-600" />
      default:
        return null
    }
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      case 'premium':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'basic':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: 'business_name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Business Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.business_name}</div>
            {row.original.first_name && row.original.last_name && (
              <div className="text-sm text-gray-500">
                {row.original.first_name} {row.original.last_name}
              </div>
            )}
            <div className="text-xs text-gray-400">
              {row.original.city}, {row.original.country}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'customer_tier',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Tier
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const tier = row.original.customer_tier
          return (
            <Badge className={`gap-1 ${getTierColor(tier)}`}>
              {getTierIcon(tier)}
              {tier}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'customer_since',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Customer Since
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.customer_since)
          const days = Math.floor(
            (new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
          )
          return (
            <div>
              <div>{date.toLocaleDateString()}</div>
              <div className="text-xs text-gray-500">{days} days ago</div>
            </div>
          )
        },
      },
      {
        accessorKey: 'rating',
        header: 'Rating',
        cell: ({ row }) => {
          const rating = row.original.rating
          const reviews = row.original.total_reviews
          return rating ? (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{parseFloat(rating).toFixed(1)}</span>
              {reviews && <span className="text-sm text-gray-500">({reviews})</span>}
            </div>
          ) : (
            <span className="text-gray-400">N/A</span>
          )
        },
      },
      {
        accessorKey: 'monitoring',
        header: 'Monitoring',
        cell: ({ row }) => {
          const enabled = row.original.monitoring_enabled
          const frequency = row.original.monitoring_frequency_hours
          return (
            <div className="flex items-center gap-2">
              {enabled ? (
                <>
                  <Bell className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">
                    Every {frequency}h
                  </span>
                </>
              ) : (
                <>
                  <BellOff className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Disabled</span>
                </>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'alerts',
        header: 'Alerts',
        cell: ({ row }) => {
          const alerts = row.original.unacknowledged_alerts
          return alerts > 0 ? (
            <Badge variant="destructive" className="gap-1">
              <Bell className="h-3 w-3" />
              {alerts} new
            </Badge>
          ) : (
            <span className="text-sm text-gray-500">None</span>
          )
        },
      },
      {
        accessorKey: 'total_removed_reviews',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Removed
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const removed = row.original.total_removed_reviews
          return (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="font-medium">{removed}</span>
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Link href={`/dashboard/customers/${row.original.id}`}>
            <Button size="sm" variant="outline" className="gap-1">
              <Eye className="h-3 w-3" />
              View
            </Button>
          </Link>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: customers,
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
      <div>
        <h1 className="text-3xl font-bold">Customers</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage paying customers and monitoring settings
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Customers</p>
              <p className="text-2xl font-bold">{stats.totalCustomers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Bell className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Monitoring</p>
              <p className="text-2xl font-bold">{stats.monitoringEnabled}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">New This Month</p>
              <p className="text-2xl font-bold">{stats.newThisMonth}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Removals</p>
              <p className="text-2xl font-bold">{stats.totalRemovals}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tier Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3">Customer Tiers</h3>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-600" />
            <span className="text-sm">Basic: {stats.basicTier}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            <span className="text-sm">Premium: {stats.premiumTier}</span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-purple-600" />
            <span className="text-sm">Enterprise: {stats.enterpriseTier}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by business name, email, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={monitoringFilter} onValueChange={setMonitoringFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Monitoring status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="enabled">Monitoring On</SelectItem>
            <SelectItem value="disabled">Monitoring Off</SelectItem>
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
                  No customers found
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
    </div>
  )
}
