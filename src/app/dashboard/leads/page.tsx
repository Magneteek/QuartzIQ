'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  ColumnDef,
  SortingState,
  flexRender,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle,
  TrendingUp,
  Calendar,
  Star,
  Download,
  CheckSquare,
  Upload,
  ExternalLink,
  AlertCircle,
  Send,
  Shield,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { RequireRole } from '@/components/auth/require-role'
import { AddEditBusinessDialog } from '@/components/leads/add-edit-business-dialog'
import { CSVImportDialog } from '@/components/leads/csv-import-dialog'
import { EditableCell } from '@/components/leads/editable-cell'
import { ReviewsDialog } from '@/components/leads/reviews-dialog'

interface Lead {
  id: string
  business_name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  category: string | null
  place_id: string | null
  address: string | null
  city: string | null
  country: string | null
  rating: number | null
  total_reviews: number | null
  lifecycle_stage: string
  data_source: string
  qualification_date: string | null
  qualified_by_name: string | null
  ready_for_enrichment: boolean
  import_status: string | null
  google_profile_url: string | null
  google_maps_url: string | null
  negative_review_url: string | null
  va_notes: string | null
  review_count: number
  latest_review_date: string | null
  oldest_review_date: string | null
  entry_method: string | null
  enrichment_priority: number | null
  created_at: string
  updated_at: string
}

interface LeadStats {
  totalLeads: number
  readyForEnrichment: number
  addedToday: number
  addedThisWeek: number
  averageRating: number
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<LeadStats>({
    totalLeads: 0,
    readyForEnrichment: 0,
    addedToday: 0,
    addedThisWeek: 0,
    averageRating: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'created_at', desc: true },
  ])
  const [globalFilter, setGlobalFilter] = useState('')
  const [showOnlyWithReviews, setShowOnlyWithReviews] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Advanced filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [ratingMin, setRatingMin] = useState<number | ''>('')
  const [ratingMax, setRatingMax] = useState<number | ''>('')
  const [countryFilter, setCountryFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [reviewsMin, setReviewsMin] = useState<number | ''>('')
  const [reviewsMax, setReviewsMax] = useState<number | ''>('')
  const [lifecycleStageFilter, setLifecycleStageFilter] = useState('all')
  const [dataSourceFilter, setDataSourceFilter] = useState('all')
  const [readyForEnrichmentFilter, setReadyForEnrichmentFilter] = useState<'all' | 'true' | 'false'>('all')

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 15,
  })
  const [total, setTotal] = useState(0)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [isBulkExporting, setIsBulkExporting] = useState(false)
  const [isBulkQueuing, setIsBulkQueuing] = useState(false)
  const [isBulkQueueDialogOpen, setIsBulkQueueDialogOpen] = useState(false)
  const [queuingLeadId, setQueuingLeadId] = useState<string | null>(null)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [reviewsDialogOpen, setReviewsDialogOpen] = useState(false)
  const [selectedBusinessForReviews, setSelectedBusinessForReviews] = useState<{
    id: string
    name: string
  } | null>(null)
  const [isMarkCustomerDialogOpen, setIsMarkCustomerDialogOpen] = useState(false)
  const [markingCustomerId, setMarkingCustomerId] = useState<string | null>(null)
  const [isBulkMarkCustomerDialogOpen, setIsBulkMarkCustomerDialogOpen] = useState(false)
  const [isBulkMarkingCustomer, setIsBulkMarkingCustomer] = useState(false)

  // Fetch leads
  const fetchLeads = async () => {
    setIsLoading(true)
    try {
      const sortBy = sorting[0]?.id || 'created_at'
      const sortOrder = sorting[0]?.desc ? 'DESC' : 'ASC'
      const offset = pagination.pageIndex * pagination.pageSize

      const params = new URLSearchParams({
        limit: pagination.pageSize.toString(),
        offset: offset.toString(),
        sortBy,
        sortOrder,
        ...(globalFilter && { search: globalFilter }),
        ...(showOnlyWithReviews && { hasReviews: 'true' }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
        ...(ratingMin !== '' && { ratingMin: ratingMin.toString() }),
        ...(ratingMax !== '' && { ratingMax: ratingMax.toString() }),
        ...(countryFilter && { country: countryFilter }),
        ...(cityFilter && { city: cityFilter }),
        ...(reviewsMin !== '' && { reviewsMin: reviewsMin.toString() }),
        ...(reviewsMax !== '' && { reviewsMax: reviewsMax.toString() }),
        ...(lifecycleStageFilter !== 'all' && { lifecycleStage: lifecycleStageFilter }),
        ...(dataSourceFilter !== 'all' && { dataSource: dataSourceFilter }),
        ...(readyForEnrichmentFilter !== 'all' && { readyForEnrichment: readyForEnrichmentFilter }),
      })

      const response = await fetch(`/api/leads?${params}`)
      const data = await response.json()

      setLeads(data.leads || [])
      setTotal(data.total || 0)
      setStats(data.stats || stats)
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [
    globalFilter,
    showOnlyWithReviews,
    dateFrom,
    dateTo,
    ratingMin,
    ratingMax,
    countryFilter,
    cityFilter,
    reviewsMin,
    reviewsMax,
    lifecycleStageFilter,
    dataSourceFilter,
    readyForEnrichmentFilter
  ])

  useEffect(() => {
    fetchLeads()
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    globalFilter,
    showOnlyWithReviews,
    dateFrom,
    dateTo,
    ratingMin,
    ratingMax,
    countryFilter,
    cityFilter,
    reviewsMin,
    reviewsMax,
    lifecycleStageFilter,
    dataSourceFilter,
    readyForEnrichmentFilter
  ])

  // Clear all filters
  const clearFilters = () => {
    setGlobalFilter('')
    setShowOnlyWithReviews(false)
    setDateFrom('')
    setDateTo('')
    setRatingMin('')
    setRatingMax('')
    setCountryFilter('')
    setCityFilter('')
    setReviewsMin('')
    setReviewsMax('')
    setLifecycleStageFilter('all')
    setDataSourceFilter('all')
    setReadyForEnrichmentFilter('all')
  }

  // Check if any advanced filters are active
  const hasActiveFilters = dateFrom || dateTo || ratingMin !== '' || ratingMax !== '' ||
    countryFilter || cityFilter || reviewsMin !== '' || reviewsMax !== '' ||
    lifecycleStageFilter !== 'all' || dataSourceFilter !== 'all' || readyForEnrichmentFilter !== 'all'

  // Handlers
  const handleAdd = () => {
    setSelectedLead(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead)
    setIsDialogOpen(true)
  }

  const handleDeleteClick = (lead: Lead) => {
    setSelectedLead(lead)
    setIsDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedLead) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        const errorMsg = data.error || `Failed to delete business (${response.status})`
        throw new Error(errorMsg)
      }

      await fetchLeads()
      setIsDeleteDialogOpen(false)
      setSelectedLead(null)

      // Show success notification
      setNotification({
        type: 'success',
        message: '✅ Business deleted successfully',
      })
      setTimeout(() => setNotification(null), 3000)
    } catch (error: any) {
      console.error('Error deleting business:', error)
      alert(`Failed to delete business: ${error.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleQueueEnrichment = async (leadId: string) => {
    setQueuingLeadId(leadId)
    setNotification(null)

    try {
      const response = await fetch(`/api/leads/${leadId}/queue-enrichment`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.details
          ? `${data.error}: ${data.details}`
          : data.error || 'Failed to queue lead for enrichment'
        throw new Error(errorMsg)
      }

      // Show success notification
      setNotification({
        type: 'success',
        message: `✅ Lead queued for enrichment successfully! Queue ID: ${data.queueItem.id}`,
      })

      // Refresh leads list to show updated status
      await fetchLeads()

      // Clear notification after 5 seconds
      setTimeout(() => setNotification(null), 5000)
    } catch (error: any) {
      console.error('Error queuing lead for enrichment:', error)
      setNotification({
        type: 'error',
        message: `❌ ${error.message || 'Failed to queue lead for enrichment'}`,
      })

      // Clear notification after 5 seconds
      setTimeout(() => setNotification(null), 5000)
    } finally {
      setQueuingLeadId(null)
    }
  }

  const handleCellUpdate = async (
    leadId: string,
    field: string,
    value: string
  ) => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      })

      if (!response.ok) {
        throw new Error('Failed to update field')
      }

      // Update local state to reflect the change
      setLeads((prevLeads) =>
        prevLeads.map((lead) =>
          lead.id === leadId ? { ...lead, [field]: value || null } : lead
        )
      )

      // Show success notification briefly
      setNotification({
        type: 'success',
        message: '✅ Updated successfully',
      })
      setTimeout(() => setNotification(null), 2000)
    } catch (error) {
      console.error('Error updating field:', error)
      throw error // Re-throw to let EditableCell handle it
    }
  }

  const handleBulkDeleteClick = () => {
    if (selectedRows.size === 0) return
    setIsBulkDeleteDialogOpen(true)
  }

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true)
    try {
      const response = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          ids: Array.from(selectedRows),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete businesses')
      }

      await fetchLeads()
      setSelectedRows(new Set())
      setIsBulkDeleteDialogOpen(false)

      // Show success notification
      setNotification({
        type: 'success',
        message: `✅ Successfully deleted ${selectedRows.size} businesses`,
      })
      setTimeout(() => setNotification(null), 3000)
    } catch (error) {
      console.error('Error deleting businesses:', error)
      setNotification({
        type: 'error',
        message: '❌ Failed to delete businesses',
      })
      setTimeout(() => setNotification(null), 3000)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleBulkExport = async () => {
    setIsBulkExporting(true)
    try {
      const response = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          ids: selectedRows.size > 0 ? Array.from(selectedRows) : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to export leads')
      }

      // Download CSV
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting leads:', error)
      alert('Failed to export leads')
    } finally {
      setIsBulkExporting(false)
    }
  }

  const handleBulkQueueClick = () => {
    if (selectedRows.size === 0) return
    setIsBulkQueueDialogOpen(true)
  }

  const handleBulkQueue = async () => {
    setIsBulkQueuing(true)
    try {
      const selectedIds = Array.from(selectedRows)
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      // Queue each lead for enrichment
      for (const leadId of selectedIds) {
        try {
          const response = await fetch(`/api/leads/${leadId}/queue-enrichment`, {
            method: 'POST',
          })

          if (response.ok) {
            successCount++
          } else {
            const data = await response.json()
            errorCount++
            const leadName = leads.find(l => l.id === leadId)?.business_name || leadId
            errors.push(`${leadName}: ${data.error || 'Failed'}`)
          }
        } catch (error) {
          errorCount++
          const leadName = leads.find(l => l.id === leadId)?.business_name || leadId
          errors.push(`${leadName}: Network error`)
        }
      }

      // Refresh leads
      await fetchLeads()
      setSelectedRows(new Set())
      setIsBulkQueueDialogOpen(false)

      // Show results notification
      if (errorCount === 0) {
        setNotification({
          type: 'success',
          message: `✅ Successfully queued ${successCount} businesses for enrichment`,
        })
      } else if (successCount === 0) {
        setNotification({
          type: 'error',
          message: `❌ Failed to queue all ${errorCount} businesses. ${errors.slice(0, 3).join(', ')}`,
        })
      } else {
        setNotification({
          type: 'success',
          message: `⚠️ Queued ${successCount} businesses. Failed: ${errorCount}. ${errors.slice(0, 2).join(', ')}`,
        })
      }
      setTimeout(() => setNotification(null), 5000)
    } catch (error) {
      console.error('Error queuing businesses:', error)
      setNotification({
        type: 'error',
        message: '❌ Failed to queue businesses for enrichment',
      })
      setTimeout(() => setNotification(null), 3000)
    } finally {
      setIsBulkQueuing(false)
    }
  }

  const handleMarkAsCustomerClick = (leadId: string) => {
    setMarkingCustomerId(leadId)
    setIsMarkCustomerDialogOpen(true)
  }

  const handleMarkAsCustomer = async () => {
    if (!markingCustomerId) return

    try {
      const response = await fetch(`/api/leads/${markingCustomerId}/mark-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monitoringFrequencyHours: 336, // 14 days default
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark as customer')
      }

      await fetchLeads()
      setIsMarkCustomerDialogOpen(false)
      setMarkingCustomerId(null)

      setNotification({
        type: 'success',
        message: `✅ Successfully marked "${data.business.name}" as customer`,
      })
      setTimeout(() => setNotification(null), 3000)
    } catch (error: any) {
      console.error('Error marking as customer:', error)
      setNotification({
        type: 'error',
        message: `❌ ${error.message || 'Failed to mark as customer'}`,
      })
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const handleBulkMarkAsCustomerClick = () => {
    if (selectedRows.size === 0) return
    setIsBulkMarkCustomerDialogOpen(true)
  }

  const handleBulkMarkAsCustomer = async () => {
    setIsBulkMarkingCustomer(true)
    try {
      const selectedIds = Array.from(selectedRows)
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      for (const leadId of selectedIds) {
        try {
          const response = await fetch(`/api/leads/${leadId}/mark-customer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              monitoringFrequencyHours: 336, // 14 days default
            }),
          })

          if (response.ok) {
            successCount++
          } else {
            const data = await response.json()
            errorCount++
            const leadName = leads.find(l => l.id === leadId)?.business_name || leadId
            errors.push(`${leadName}: ${data.error || 'Failed'}`)
          }
        } catch (error) {
          errorCount++
          const leadName = leads.find(l => l.id === leadId)?.business_name || leadId
          errors.push(`${leadName}: Network error`)
        }
      }

      await fetchLeads()
      setSelectedRows(new Set())
      setIsBulkMarkCustomerDialogOpen(false)

      if (errorCount === 0) {
        setNotification({
          type: 'success',
          message: `✅ Successfully marked ${successCount} businesses as customers`,
        })
      } else if (successCount === 0) {
        setNotification({
          type: 'error',
          message: `❌ Failed to mark all ${errorCount} businesses. ${errors.slice(0, 3).join(', ')}`,
        })
      } else {
        setNotification({
          type: 'success',
          message: `⚠️ Marked ${successCount} as customers. Failed: ${errorCount}. ${errors.slice(0, 2).join(', ')}`,
        })
      }
      setTimeout(() => setNotification(null), 5000)
    } catch (error) {
      console.error('Error marking businesses as customers:', error)
      setNotification({
        type: 'error',
        message: '❌ Failed to mark businesses as customers',
      })
      setTimeout(() => setNotification(null), 3000)
    } finally {
      setIsBulkMarkingCustomer(false)
    }
  }

  const toggleRowSelection = (id: string) => {
    const newSelection = new Set(selectedRows)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedRows(newSelection)
  }

  const toggleAllRows = () => {
    if (selectedRows.size === leads.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(leads.map((lead) => lead.id)))
    }
  }

  // Define columns
  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={selectedRows.size === leads.length && leads.length > 0}
            onCheckedChange={() => toggleAllRows()}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedRows.has(row.original.id)}
            onCheckedChange={() => toggleRowSelection(row.original.id)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'business_name',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="hover:bg-transparent"
            >
              Business Name
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => (
          <div className="min-w-[200px]">
            <EditableCell
              value={row.original.business_name}
              leadId={row.original.id}
              field="business_name"
              onSave={handleCellUpdate}
              className="font-medium"
            />
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => (
          <div className="min-w-[150px]">
            <EditableCell
              value={row.original.category}
              leadId={row.original.id}
              field="category"
              onSave={handleCellUpdate}
            />
          </div>
        ),
      },
      {
        accessorKey: 'first_name',
        header: 'First Name',
        cell: ({ row }) => (
          <div className="min-w-[120px]">
            <EditableCell
              value={row.original.first_name}
              leadId={row.original.id}
              field="first_name"
              onSave={handleCellUpdate}
            />
          </div>
        ),
      },
      {
        accessorKey: 'last_name',
        header: 'Last Name',
        cell: ({ row }) => (
          <div className="min-w-[120px]">
            <EditableCell
              value={row.original.last_name}
              leadId={row.original.id}
              field="last_name"
              onSave={handleCellUpdate}
            />
          </div>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => (
          <div className="min-w-[200px]">
            <EditableCell
              value={row.original.email}
              leadId={row.original.id}
              field="email"
              type="email"
              onSave={handleCellUpdate}
            />
          </div>
        ),
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => (
          <div className="min-w-[140px]">
            <EditableCell
              value={row.original.phone}
              leadId={row.original.id}
              field="phone"
              onSave={handleCellUpdate}
            />
          </div>
        ),
      },
      {
        accessorKey: 'website',
        header: 'Website',
        cell: ({ row }) => (
          <div className="min-w-[200px]">
            <EditableCell
              value={row.original.website}
              leadId={row.original.id}
              field="website"
              type="url"
              onSave={handleCellUpdate}
            />
          </div>
        ),
      },
      {
        accessorKey: 'address',
        header: 'Address',
        cell: ({ row }) => (
          <div className="min-w-[200px]">
            <EditableCell
              value={row.original.address}
              leadId={row.original.id}
              field="address"
              onSave={handleCellUpdate}
            />
          </div>
        ),
      },
      {
        accessorKey: 'city',
        header: 'City',
        cell: ({ row }) => (
          <div className="min-w-[120px]">
            <EditableCell
              value={row.original.city}
              leadId={row.original.id}
              field="city"
              onSave={handleCellUpdate}
            />
          </div>
        ),
      },
      {
        accessorKey: 'country',
        header: 'Country',
        cell: ({ row }) => (
          <div className="min-w-[100px]">
            <EditableCell
              value={row.original.country}
              leadId={row.original.id}
              field="country"
              onSave={handleCellUpdate}
            />
          </div>
        ),
      },
      {
        accessorKey: 'google_profile_url',
        header: 'Google Profile URL',
        cell: ({ row }) => (
          <div className="min-w-[250px]">
            <EditableCell
              value={row.original.google_profile_url}
              leadId={row.original.id}
              field="google_profile_url"
              type="url"
              onSave={handleCellUpdate}
            />
          </div>
        ),
      },
      {
        accessorKey: 'negative_review_url',
        header: 'Negative Review URL',
        cell: ({ row }) => (
          <div className="min-w-[250px]">
            <EditableCell
              value={row.original.negative_review_url}
              leadId={row.original.id}
              field="negative_review_url"
              type="url"
              onSave={handleCellUpdate}
            />
          </div>
        ),
      },
      {
        accessorKey: 'rating',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="hover:bg-transparent"
            >
              Rating
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const rating = row.original.rating
          const reviews = row.original.total_reviews
          return rating ? (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{Number(rating).toFixed(1)}</span>
              {reviews && (
                <span className="text-sm text-gray-500">({reviews})</span>
              )}
            </div>
          ) : (
            <span className="text-gray-400">N/A</span>
          )
        },
      },
      {
        accessorKey: 'review_data',
        header: 'Review Data',
        cell: ({ row }) => {
          const reviewAge = row.original.latest_review_date
            ? Math.floor(
                (new Date().getTime() -
                  new Date(row.original.latest_review_date).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null

          return (
            <div className="space-y-1">
              <Badge variant="secondary">{row.original.review_count} reviews</Badge>
              {row.original.latest_review_date && (
                <div className="text-xs text-gray-500">
                  Latest: {new Date(row.original.latest_review_date).toLocaleDateString()}
                  <br />
                  Age: {reviewAge} days ago
                </div>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'import_info',
        header: 'Import Info',
        cell: ({ row }) => {
          const source = row.original.data_source
          const status = row.original.import_status || 'pending'
          const sourceColors: Record<string, string> = {
            manual: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            scraper: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
            import: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
          }
          const statusColors: Record<string, string> = {
            pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
          }
          return (
            <div className="space-y-1">
              <Badge className={sourceColors[source] || sourceColors.manual}>
                {source || 'manual'}
              </Badge>
              <Badge className={statusColors[status]}>
                {status}
              </Badge>
              <div className="text-xs text-gray-500">
                {new Date(row.original.created_at).toLocaleDateString()}
              </div>
            </div>
          )
        },
      },
      {
        id: 'reviews',
        header: 'Reviews',
        cell: ({ row }) => {
          const count = row.original.review_count
          return (
            <div className="min-w-[120px]">
              {count > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedBusinessForReviews({
                      id: row.original.id,
                      name: row.original.business_name,
                    })
                    setReviewsDialogOpen(true)
                  }}
                  className="flex items-center gap-2"
                >
                  <Star className="h-4 w-4 text-orange-500" />
                  <span>{count} review{count !== 1 ? 's' : ''}</span>
                </Button>
              ) : (
                <span className="text-gray-400 text-sm">No reviews</span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'va_notes',
        header: 'VA Notes',
        cell: ({ row }) => (
          <div className="min-w-[250px]">
            <EditableCell
              value={row.original.va_notes}
              leadId={row.original.id}
              field="va_notes"
              type="textarea"
              onSave={handleCellUpdate}
            />
          </div>
        ),
      },
      {
        accessorKey: 'ready_for_enrichment',
        header: 'Status',
        cell: ({ row }) => {
          return row.original.ready_for_enrichment ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Ready
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
              In Progress
            </Badge>
          )
        },
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="hover:bg-transparent"
            >
              Created
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          return new Date(row.original.created_at).toLocaleDateString()
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          return (
            <div className="flex items-center gap-1">
              {/* Google Profile URL */}
              {row.original.google_profile_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(row.original.google_profile_url!, '_blank')}
                  title="View Google Profile"
                >
                  <ExternalLink className="h-4 w-4 text-blue-600" />
                </Button>
              )}

              {/* Negative Review URL */}
              {row.original.negative_review_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(row.original.negative_review_url!, '_blank')}
                  title="View Negative Review"
                >
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </Button>
              )}

              {/* Queue for Enrichment */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQueueEnrichment(row.original.id)}
                disabled={queuingLeadId === row.original.id}
                title={
                  queuingLeadId === row.original.id
                    ? 'Queuing...'
                    : 'Queue for Enrichment'
                }
              >
                {queuingLeadId === row.original.id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent"></div>
                ) : (
                  <Send className="h-4 w-4 text-green-600" />
                )}
              </Button>

              {/* Mark as Customer */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMarkAsCustomerClick(row.original.id)}
                title="Mark as Customer"
              >
                <Shield className="h-4 w-4 text-purple-600" />
              </Button>

              {/* Edit */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(row.original)}
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </Button>

              {/* Delete */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteClick(row.original)}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          )
        },
      },
    ],
    [selectedRows, leads, queuingLeadId]
  )

  // Create table instance
  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.pageSize),
    state: {
      sorting,
      pagination,
      globalFilter,
    },
  })

  return (
    <RequireRole allowedRoles={['admin', 'va']}>
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8 text-blue-600" />
              Lead Qualification
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Stage 1: Manual lead entry and qualification
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add New Business
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Leads</p>
                <p className="text-2xl font-bold">{stats.totalLeads}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ready</p>
                <p className="text-2xl font-bold">{stats.readyForEnrichment}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Added Today</p>
                <p className="text-2xl font-bold">{stats.addedToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">This Week</p>
                <p className="text-2xl font-bold">{stats.addedThisWeek}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Rating</p>
                <p className="text-2xl font-bold">
                  {stats.averageRating ? stats.averageRating.toFixed(1) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Banner */}
        {notification && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              notification.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{notification.message}</p>
              <button
                onClick={() => setNotification(null)}
                className="text-sm font-semibold underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Search and Bulk Actions */}
        <div className="mb-4 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search businesses..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={showOnlyWithReviews ? "default" : "outline"}
              size="default"
              onClick={() => setShowOnlyWithReviews(!showOnlyWithReviews)}
              className={showOnlyWithReviews ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              <Star className="mr-2 h-4 w-4" />
              {showOnlyWithReviews ? 'Showing With Reviews' : 'Show With Reviews Only'}
            </Button>
            <Button
              variant={showAdvancedFilters || hasActiveFilters ? "default" : "outline"}
              size="default"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={showAdvancedFilters || hasActiveFilters ? "bg-purple-600 hover:bg-purple-700" : ""}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters {hasActiveFilters && `(${Object.values({dateFrom, dateTo, ratingMin, ratingMax, countryFilter, cityFilter, reviewsMin, reviewsMax}).filter(Boolean).length})`}
              {showAdvancedFilters ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
            </Button>
          </div>

          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Advanced Filters
                </h3>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="mr-1 h-3 w-3" />
                    Clear All
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Date Range */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Date From</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Date To</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Rating Range */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Min Rating</label>
                  <Input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    placeholder="0.0"
                    value={ratingMin}
                    onChange={(e) => setRatingMin(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Max Rating</label>
                  <Input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    placeholder="5.0"
                    value={ratingMax}
                    onChange={(e) => setRatingMax(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full"
                  />
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Country</label>
                  <Input
                    type="text"
                    placeholder="e.g., US, GB, CA"
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">City</label>
                  <Input
                    type="text"
                    placeholder="e.g., New York"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Review Count */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Min Reviews</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={reviewsMin}
                    onChange={(e) => setReviewsMin(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Max Reviews</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="1000"
                    value={reviewsMax}
                    onChange={(e) => setReviewsMax(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full"
                  />
                </div>

                {/* Lifecycle Stage */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Lifecycle Stage</label>
                  <select
                    value={lifecycleStageFilter}
                    onChange={(e) => setLifecycleStageFilter(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
                  >
                    <option value="all">All Stages</option>
                    <option value="prospect">Prospect</option>
                    <option value="lead">Lead</option>
                    <option value="qualified">Qualified</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>

                {/* Data Source */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Data Source</label>
                  <select
                    value={dataSourceFilter}
                    onChange={(e) => setDataSourceFilter(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
                  >
                    <option value="all">All Sources</option>
                    <option value="manual">Manual</option>
                    <option value="scraper">Scraper</option>
                    <option value="import">Import</option>
                    <option value="ghl_webhook">GHL Webhook</option>
                  </select>
                </div>

                {/* Ready for Enrichment */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Enrichment Status</label>
                  <select
                    value={readyForEnrichmentFilter}
                    onChange={(e) => setReadyForEnrichmentFilter(e.target.value as 'all' | 'true' | 'false')}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="true">Ready for Enrichment</option>
                    <option value="false">Not Ready</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Actions Bar */}
          {selectedRows.size > 0 && (
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 relative z-10">
              <div className="flex items-center gap-2 text-sm">
                <CheckSquare className="h-4 w-4 text-blue-600" />
                <span className="font-medium">
                  {selectedRows.size} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkQueueClick}
                  disabled={isBulkQueuing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {isBulkQueuing ? 'Queuing...' : 'Queue for Enrichment'}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkMarkAsCustomerClick}
                  disabled={isBulkMarkingCustomer}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  {isBulkMarkingCustomer ? 'Marking...' : 'Mark as Customer'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkExport}
                  disabled={isBulkExporting}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isBulkExporting ? 'Exporting...' : 'Export Selected'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDeleteClick}
                  disabled={isBulkDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
                </Button>
              </div>
            </div>
          )}

          {/* Export All Button */}
          {selectedRows.size === 0 && total > 0 && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkExport}
                disabled={isBulkExporting}
              >
                <Download className="mr-2 h-4 w-4" />
                {isBulkExporting ? 'Exporting...' : `Export All (${total})`}
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
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
                  {table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="text-center py-8 text-gray-500"
                      >
                        No leads found
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className={selectedRows.has(row.original.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {pagination.pageIndex * pagination.pageSize + 1} to{' '}
                  {Math.min(
                    (pagination.pageIndex + 1) * pagination.pageSize,
                    total
                  )}{' '}
                  of {total} results
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {pagination.pageIndex + 1} of {table.getPageCount()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Add/Edit Business Dialog */}
        <AddEditBusinessDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          lead={selectedLead}
          onSuccess={fetchLeads}
        />

        {/* CSV Import Dialog */}
        <CSVImportDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          onSuccess={fetchLeads}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Business</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {selectedLead?.business_name}? This
                action cannot be undone and will also delete all associated reviews.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Queue Enrichment Confirmation Dialog */}
        <Dialog open={isBulkQueueDialogOpen} onOpenChange={setIsBulkQueueDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Queue Multiple Businesses for Enrichment</DialogTitle>
              <DialogDescription>
                Queue {selectedRows.size} selected businesses for contact enrichment?
                This will move them to the enrichment queue to find executive contact information.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  What happens next:
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                  <li>Businesses moved to lifecycle stage: <strong>qualified</strong></li>
                  <li>Added to enrichment queue for processing</li>
                  <li>Will be enriched using 3-tier strategy (Claude → Apify → Apollo)</li>
                  <li>View progress in Contact Enrichment page</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsBulkQueueDialogOpen(false)}
                disabled={isBulkQueuing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkQueue}
                disabled={isBulkQueuing}
                className="bg-green-600 hover:bg-green-700"
              >
                <Send className="mr-2 h-4 w-4" />
                {isBulkQueuing ? 'Queuing...' : `Queue ${selectedRows.size} Businesses`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Confirmation Dialog */}
        <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Multiple Businesses</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {selectedRows.size} selected businesses? This
                action cannot be undone and will also delete all associated reviews for these businesses.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsBulkDeleteDialogOpen(false)}
                disabled={isBulkDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? 'Deleting...' : `Delete ${selectedRows.size} Businesses`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mark as Customer Confirmation Dialog */}
        <Dialog open={isMarkCustomerDialogOpen} onOpenChange={setIsMarkCustomerDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as Customer</DialogTitle>
              <DialogDescription>
                Mark this business as a paying customer? This will enable automatic monitoring for new negative reviews.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  What happens next:
                </p>
                <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-4 list-disc">
                  <li>Lifecycle stage updated to: <strong>customer</strong></li>
                  <li>Monitoring enabled: <strong>Yes</strong></li>
                  <li>Auto-check for new reviews: <strong>Every 14 days</strong></li>
                  <li>Alerts sent to GHL when negative review (≤3★) detected</li>
                  <li>View in Customer Dashboard</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsMarkCustomerDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleMarkAsCustomer}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Shield className="mr-2 h-4 w-4" />
                Mark as Customer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Mark as Customer Confirmation Dialog */}
        <Dialog open={isBulkMarkCustomerDialogOpen} onOpenChange={setIsBulkMarkCustomerDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark Multiple Businesses as Customers</DialogTitle>
              <DialogDescription>
                Mark {selectedRows.size} selected businesses as paying customers? This will enable automatic monitoring for all of them.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  What happens next:
                </p>
                <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-4 list-disc">
                  <li>All businesses moved to lifecycle stage: <strong>customer</strong></li>
                  <li>Monitoring enabled for all: <strong>Yes</strong></li>
                  <li>Auto-check frequency: <strong>Every 14 days</strong></li>
                  <li>GHL alerts enabled for negative reviews (≤3★)</li>
                  <li>All visible in Customer Dashboard</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsBulkMarkCustomerDialogOpen(false)}
                disabled={isBulkMarkingCustomer}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkMarkAsCustomer}
                disabled={isBulkMarkingCustomer}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Shield className="mr-2 h-4 w-4" />
                {isBulkMarkingCustomer ? 'Marking...' : `Mark ${selectedRows.size} as Customers`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reviews Dialog */}
        {selectedBusinessForReviews && (
          <ReviewsDialog
            open={reviewsDialogOpen}
            onOpenChange={setReviewsDialogOpen}
            businessId={selectedBusinessForReviews.id}
            businessName={selectedBusinessForReviews.name}
          />
        )}
      </div>
    </RequireRole>
  )
}
