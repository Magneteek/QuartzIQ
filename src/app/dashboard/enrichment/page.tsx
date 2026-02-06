'use client'

import { useEffect, useState, useMemo } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowUpDown,
  Search,
  Mail,
  Phone,
  User,
  Star,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  CheckSquare,
  Trash2,
  X,
} from 'lucide-react'

interface Business {
  id: string
  business_name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  category: string | null
  address: string | null
  city: string | null
  country: string | null
  rating: string
  total_reviews: number
  enrichment_status: string
  enrichment_priority: number
  enrichment_confidence: number | null
  qualification_date: string
  qualified_by_name: string | null
  enriched_by_name: string | null
  va_notes: string | null
  review_count: number
  google_profile_url: string | null
  negative_review_url: string | null
  created_at: string
  updated_at: string
}

interface Stats {
  pending: number
  inProgress: number
  completed: number
  completedToday: number
  avgConfidence: number
}

export default function EnrichmentPage() {
  const [leads, setLeads] = useState<Business[]>([])
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    inProgress: 0,
    completed: 0,
    completedToday: 0,
    avgConfidence: 0,
  })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'enrichment_priority', desc: true }, // Sort by priority by default
  ])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
  const [enrichmentDialogOpen, setEnrichmentDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingResults, setProcessingResults] = useState<any>(null)
  const [isProcessQueueDialogOpen, setIsProcessQueueDialogOpen] = useState(false)
  const [maxJobsToProcess, setMaxJobsToProcess] = useState<number | 'all'>('all')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    enrichment_confidence: 80,
    enrichment_source: 'manual' as 'manual' | 'apollo' | 'apify' | 'multiple',
  })

  const fetchLeads = async () => {
    try {
      setLoading(true)
      const sortBy = sorting[0]?.id || 'enrichment_priority'
      const sortOrder = sorting[0]?.desc ? 'DESC' : 'ASC'

      const params = new URLSearchParams({
        limit: '50',
        offset: '0',
        sortBy,
        sortOrder,
        status: statusFilter,
        ...(searchTerm && { search: searchTerm }),
      })

      const response = await fetch(`/api/enrichment?${params}`)
      if (!response.ok) throw new Error('Failed to fetch leads')

      const data = await response.json()
      setLeads(data.leads || [])
      setStats(data.stats || stats)
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error fetching leads:', error)
      setNotification({
        type: 'error',
        message: 'Failed to load enrichment queue',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [sorting, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads()
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const openEnrichmentDialog = (business: Business) => {
    setSelectedBusiness(business)
    setFormData({
      first_name: business.first_name || '',
      last_name: business.last_name || '',
      email: business.email || '',
      phone: business.phone || '',
      enrichment_confidence: business.enrichment_confidence || 80,
      enrichment_source: 'manual',
    })
    setEnrichmentDialogOpen(true)
  }

  const saveEnrichment = async (markComplete: boolean) => {
    if (!selectedBusiness) return

    try {
      setSaving(true)

      const payload = {
        ...formData,
        enrichment_status: markComplete ? 'completed' : 'in_progress',
        complete_enrichment: markComplete,
      }

      const response = await fetch(`/api/enrichment/${selectedBusiness.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error('Failed to save enrichment')

      setNotification({
        type: 'success',
        message: markComplete
          ? 'Lead enriched and moved to qualified stage!'
          : 'Enrichment progress saved',
      })

      setEnrichmentDialogOpen(false)
      fetchLeads()
    } catch (error) {
      console.error('Error saving enrichment:', error)
      setNotification({
        type: 'error',
        message: 'Failed to save enrichment data',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleProcessQueueClick = () => {
    console.log('[Process Queue] Button clicked')
    console.log('[Process Queue] Stats pending:', stats.pending)
    setIsProcessQueueDialogOpen(true)
  }

  const processQueue = async () => {
    const isSelectiveProcessing = selectedRows.size > 0
    const jobsToProcess = isSelectiveProcessing
      ? selectedRows.size
      : (maxJobsToProcess === 'all' ? stats.pending : maxJobsToProcess)

    console.log('[Process Queue] Starting...')
    console.log('[Process Queue] Selective processing:', isSelectiveProcessing)
    console.log('[Process Queue] Jobs to process:', jobsToProcess)
    setIsProcessQueueDialogOpen(false)
    setIsProcessing(true)
    setProcessingResults(null)
    setNotification({
      type: 'success',
      message: `⚙️ Processing ${jobsToProcess} ${jobsToProcess === 1 ? 'lead' : 'leads'}... This may take a few minutes.`,
    })

    try {
      console.log('[Process Queue] Calling API...')
      const payload = isSelectiveProcessing
        ? { businessIds: Array.from(selectedRows) }
        : { maxJobs: jobsToProcess }

      const response = await fetch('/api/enrichment/process-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      console.log('[Process Queue] Response status:', response.status)

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        console.error('[Process Queue] Error response:', data)
        throw new Error(data.details || data.error || 'Failed to process queue')
      }

      const data = await response.json()
      console.log('[Process Queue] Success:', data)
      setProcessingResults(data)

      setNotification({
        type: 'success',
        message: `✅ Processed ${data.summary.jobsProcessed} leads! ${data.summary.successCount} succeeded, ${data.summary.failureCount} failed. Total cost: $${data.summary.totalCost.toFixed(4)}`,
      })

      // Clear selection and refresh leads list
      setSelectedRows(new Set())
      await fetchLeads()
    } catch (error: any) {
      console.error('[Process Queue] Error:', error)
      setNotification({
        type: 'error',
        message: `❌ Queue processing failed: ${error.message}`,
      })
    } finally {
      setIsProcessing(false)
      setTimeout(() => setNotification(null), 10000) // Show for 10 seconds
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

  const handleExportClick = () => {
    if (selectedRows.size === 0) return
    setIsExportDialogOpen(true)
  }

  const handleRemoveFromQueue = async (businessIds: string[]) => {
    try {
      const response = await fetch('/api/enrichment/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessIds }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove from queue')
      }

      const data = await response.json()
      setNotification({
        type: 'success',
        message: `✅ Removed ${businessIds.length} ${businessIds.length === 1 ? 'lead' : 'leads'} from enrichment queue`,
      })

      // Clear selection and refresh
      setSelectedRows(new Set())
      await fetchLeads()

      setTimeout(() => setNotification(null), 3000)
    } catch (error: any) {
      console.error('Remove error:', error)
      setNotification({
        type: 'error',
        message: `❌ Failed to remove: ${error.message}`,
      })
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const handleRemoveSelected = () => {
    if (selectedRows.size === 0) return
    if (confirm(`Remove ${selectedRows.size} ${selectedRows.size === 1 ? 'lead' : 'leads'} from enrichment queue?`)) {
      handleRemoveFromQueue(Array.from(selectedRows))
    }
  }

  const handleRemoveSingle = (businessId: string, businessName: string) => {
    if (confirm(`Remove "${businessName}" from enrichment queue?`)) {
      handleRemoveFromQueue([businessId])
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const selectedIds = Array.from(selectedRows)
      console.log('[Export] Selected IDs:', selectedIds)
      const businessesToExport = leads.filter(lead => selectedIds.includes(lead.id))
      console.log('[Export] Businesses to export:', businessesToExport.length)

      // Filter: Only export businesses with valid phone OR email (not empty strings)
      const exportableBusinesses = businessesToExport.filter(
        b => (b.email && b.email.trim()) || (b.phone && b.phone.trim())
      )
      console.log('[Export] Exportable businesses (with phone/email):', exportableBusinesses.length)

      if (exportableBusinesses.length === 0) {
        setNotification({
          type: 'error',
          message: '❌ No businesses have phone or email. Cannot export to CRM.',
        })
        setIsExportDialogOpen(false)
        setTimeout(() => setNotification(null), 3000)
        return
      }

      // Fetch qualifying reviews for each business
      console.log('[Export] Fetching qualifying reviews...')
      const businessIds = exportableBusinesses.map(b => b.id)
      const reviewsResponse = await fetch('/api/enrichment/qualifying-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessIds })
      })

      let reviewsData: Record<string, any> = {}
      if (reviewsResponse.ok) {
        const reviewsResult = await reviewsResponse.json()
        reviewsData = reviewsResult.reviews || {}
        console.log('[Export] Fetched reviews for', Object.keys(reviewsData).length, 'businesses')
      } else {
        console.warn('[Export] Failed to fetch reviews, continuing without review data')
      }

      // Format contacts for Quartz/GHL API with all custom fields
      const contacts = exportableBusinesses.map(b => {
        const review = reviewsData[b.id]

        // Extract image URL from review if available
        let reviewImageUrl = ''
        if (review?.raw_data?.reviewImageUrls && Array.isArray(review.raw_data.reviewImageUrls)) {
          reviewImageUrl = review.raw_data.reviewImageUrls[0] || ''
        } else if (review?.raw_data?.images && Array.isArray(review.raw_data.images)) {
          reviewImageUrl = review.raw_data.images[0] || ''
        }

        return {
          // Basic contact info
          name: b.business_name,
          address: b.address || '',
          phone: b.phone || '',
          email: b.email || '',
          website: b.website || '',
          source: 'QuartzIQ-Enrichment',

          // Custom fields for GHL
          customFieldsData: {
            companyName: b.business_name,
            website: b.website || '',
            googleUrl: b.google_profile_url || '',
            nicheCategory: b.category || '',
            reviewDate: review?.published_date || '',
            reviewStars: review?.rating?.toString() || '',
            qualifiedReviewsContent: review?.text || '',
            qualifiedReviewUrl: b.negative_review_url || '',
            googleQualifiedReviews: b.total_reviews?.toString() || b.review_count?.toString() || '',
            reviewImageUrl: reviewImageUrl
          },

          // Tag with "image-content" if review has image
          hasReviewImage: !!reviewImageUrl
        }
      })
      console.log('[Export] Formatted contacts:', contacts)

      const payload = {
        contacts,
        clientId: 'default'
      }
      console.log('[Export] Sending payload:', payload)

      const response = await fetch('/api/quartz-leads/send-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      console.log('[Export] Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[Export] Error response:', errorData)
        console.error('[Export] Full error details:', JSON.stringify(errorData, null, 2))
        if (errorData.errors && Array.isArray(errorData.errors)) {
          console.error('[Export] Individual errors:')
          errorData.errors.forEach((err: any, i: number) => {
            console.error(`  Error ${i + 1}:`, err)
          })
        }
        throw new Error(errorData.error || errorData.message || 'Failed to export contacts')
      }

      const data = await response.json()
      console.log('[Export] Success response:', data)

      setSelectedRows(new Set())
      setIsExportDialogOpen(false)

      if (data.success) {
        setNotification({
          type: 'success',
          message: `✅ Successfully exported ${data.summary.successful} contacts to Quartz! Failed: ${data.summary.failed}`,
        })
      } else {
        throw new Error(data.error || 'Export failed')
      }

      setTimeout(() => setNotification(null), 5000)
    } catch (error: any) {
      console.error('Export error:', error)
      setNotification({
        type: 'error',
        message: `❌ Failed to export contacts: ${error.message}`,
      })
      setTimeout(() => setNotification(null), 3000)
    } finally {
      setIsExporting(false)
    }
  }

  const columns = useMemo<ColumnDef<Business>[]>(
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
            {row.original.category && (
              <div className="text-sm text-gray-500">{row.original.category}</div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'contact_info',
        header: 'Contact Info',
        cell: ({ row }) => {
          const hasEmail = row.original.email
          const hasPhone = row.original.phone
          const hasName = row.original.first_name && row.original.last_name

          return (
            <div className="space-y-1">
              {hasName ? (
                <div className="flex items-center gap-1 text-sm">
                  <User className="h-3 w-3 text-green-600" />
                  <span>
                    {row.original.first_name} {row.original.last_name}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <User className="h-3 w-3" />
                  <span>No name</span>
                </div>
              )}
              {hasEmail ? (
                <div className="flex items-center gap-1 text-sm">
                  <Mail className="h-3 w-3 text-green-600" />
                  <span className="truncate">{row.original.email}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <Mail className="h-3 w-3" />
                  <span>No email</span>
                </div>
              )}
              {hasPhone ? (
                <div className="flex items-center gap-1 text-sm">
                  <Phone className="h-3 w-3 text-green-600" />
                  <span>{row.original.phone}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <Phone className="h-3 w-3" />
                  <span>No phone</span>
                </div>
              )}
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
        accessorKey: 'enrichment_status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.original.enrichment_status
          const confidence = row.original.enrichment_confidence

          let badgeVariant: 'default' | 'secondary' | 'outline' = 'outline'
          let icon = <Clock className="h-3 w-3" />

          if (status === 'completed') {
            badgeVariant = 'default'
            icon = <CheckCircle2 className="h-3 w-3" />
          } else if (status === 'in_progress') {
            badgeVariant = 'secondary'
            icon = <Loader2 className="h-3 w-3 animate-spin" />
          } else if (status === 'failed') {
            icon = <AlertCircle className="h-3 w-3" />
          }

          return (
            <div className="space-y-1">
              <Badge variant={badgeVariant} className="gap-1">
                {icon}
                {status || 'pending'}
              </Badge>
              {confidence && (
                <div className="text-xs text-gray-500">
                  Confidence: {confidence}%
                </div>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'enrichment_priority',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Priority
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const priority = row.original.enrichment_priority
          let color = 'bg-gray-200'
          if (priority >= 75) color = 'bg-red-500'
          else if (priority >= 50) color = 'bg-yellow-500'
          else if (priority >= 25) color = 'bg-blue-500'

          return (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${color}`} />
              <span>{priority}</span>
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => openEnrichmentDialog(row.original)}
              disabled={row.original.enrichment_status === 'completed'}
            >
              {row.original.enrichment_status === 'completed'
                ? 'Completed'
                : row.original.email
                ? 'Update'
                : 'Enrich'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRemoveSingle(row.original.id, row.original.business_name)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [leads, selectedRows]
  )

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      rowSelection: Object.fromEntries(Array.from(selectedRows).map(id => [id, true])),
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contact Enrichment</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Find and verify contact information for qualified leads
          </p>
        </div>
        <div className="flex gap-3">
          {selectedRows.size > 0 ? (
            <Button
              onClick={() => setIsProcessQueueDialogOpen(true)}
              disabled={isProcessing}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckSquare className="mr-2 h-5 w-5" />
                  Process Selected ({selectedRows.size})
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleProcessQueueClick}
              disabled={isProcessing || stats.pending === 0}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Process Queue ({stats.pending})
                </>
              )}
            </Button>
          )}

          {selectedRows.size > 0 && (
            <>
              <Button
                onClick={handleExportClick}
                disabled={isExporting}
                size="lg"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Export to Quartz ({selectedRows.size})
                  </>
                )}
              </Button>
              <Button
                onClick={handleRemoveSelected}
                variant="destructive"
                size="lg"
              >
                <Trash2 className="mr-2 h-5 w-5" />
                Remove Selected ({selectedRows.size})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Loader2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">In Progress</p>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
              <p className="text-2xl font-bold">{stats.completed}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Star className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Today</p>
              <p className="text-2xl font-bold">{stats.completedToday}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Confidence</p>
              <p className="text-2xl font-bold">
                {stats.avgConfidence ? stats.avgConfidence.toFixed(0) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`p-4 rounded-lg ${
            notification.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="text-sm underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Processing Results */}
      {processingResults && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                Queue Processing Results
              </h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-blue-600 dark:text-blue-400">Jobs Processed:</span>
                  <span className="ml-2 font-medium">{processingResults.summary.jobsProcessed}</span>
                </div>
                <div>
                  <span className="text-green-600 dark:text-green-400">Success:</span>
                  <span className="ml-2 font-medium">{processingResults.summary.successCount}</span>
                </div>
                <div>
                  <span className="text-red-600 dark:text-red-400">Failed:</span>
                  <span className="ml-2 font-medium">{processingResults.summary.failureCount}</span>
                </div>
                <div>
                  <span className="text-purple-600 dark:text-purple-400">Total Cost:</span>
                  <span className="ml-2 font-medium">${processingResults.summary.totalCost.toFixed(4)}</span>
                </div>
              </div>
              {processingResults.results && processingResults.results.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-blue-700 dark:text-blue-300 hover:underline">
                    View detailed results
                  </summary>
                  <div className="mt-2 space-y-1 text-xs">
                    {processingResults.results.map((result: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <span>{result.success ? '✅' : '❌'}</span>
                        <span className="font-medium">{result.businessName}</span>
                        <span className="text-gray-500">
                          ({result.contactsEnriched} contacts, {result.apiCalls} API calls, ${result.cost.toFixed(4)})
                        </span>
                        {result.error && <span className="text-red-600">- {result.error}</span>}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
            <button
              onClick={() => setProcessingResults(null)}
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
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
                  No leads ready for enrichment
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

      {/* Process Queue Confirmation Dialog */}
      <Dialog open={isProcessQueueDialogOpen} onOpenChange={setIsProcessQueueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Automatic Enrichment?</DialogTitle>
            <DialogDescription>
              This will automatically process pending leads using a 3-tier cost-optimized strategy:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">FREE</div>
                <div>
                  <p className="font-medium">1. Claude Website Research</p>
                  <p className="text-sm text-gray-600">Scrapes business website for executive info (40% success rate)</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">$0.005</div>
                <div>
                  <p className="font-medium">2. Apify Leads Enrichment</p>
                  <p className="text-sm text-gray-600">Extracts employee data from Google Maps (50% cheaper than Apollo!)</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">$0.01-0.02</div>
                <div>
                  <p className="font-medium">3. Apollo API</p>
                  <p className="text-sm text-gray-600">Professional database search (final fallback)</p>
                </div>
              </div>
            </div>

            {/* Queue Size Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">How many leads to process?</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={maxJobsToProcess === 'all' ? 'default' : 'outline'}
                  onClick={() => setMaxJobsToProcess('all')}
                  className="flex flex-col items-center py-4"
                >
                  <span className="text-lg font-bold">{stats.pending}</span>
                  <span className="text-xs">All Pending</span>
                </Button>
                <Button
                  type="button"
                  variant={maxJobsToProcess === 10 ? 'default' : 'outline'}
                  onClick={() => setMaxJobsToProcess(10)}
                  className="flex flex-col items-center py-4"
                >
                  <span className="text-lg font-bold">10</span>
                  <span className="text-xs">Test Batch</span>
                </Button>
                <Button
                  type="button"
                  variant={maxJobsToProcess === 50 ? 'default' : 'outline'}
                  onClick={() => setMaxJobsToProcess(50)}
                  className="flex flex-col items-center py-4"
                >
                  <span className="text-lg font-bold">50</span>
                  <span className="text-xs">Medium Batch</span>
                </Button>
                <Button
                  type="button"
                  variant={maxJobsToProcess === 100 ? 'default' : 'outline'}
                  onClick={() => setMaxJobsToProcess(100)}
                  className="flex flex-col items-center py-4"
                >
                  <span className="text-lg font-bold">100</span>
                  <span className="text-xs">Large Batch</span>
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                <strong>
                  Will process: {maxJobsToProcess === 'all' ? stats.pending : Math.min(maxJobsToProcess, stats.pending)} leads
                </strong>
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Estimated time: {Math.min(maxJobsToProcess === 'all' ? stats.pending : maxJobsToProcess, stats.pending) * 5}-
                {Math.min(maxJobsToProcess === 'all' ? stats.pending : maxJobsToProcess, stats.pending) * 10} seconds
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Estimated cost: $
                {(Math.min(maxJobsToProcess === 'all' ? stats.pending : maxJobsToProcess, stats.pending) * 0.0065).toFixed(2)}
                {' '}(avg $0.0065/lead)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsProcessQueueDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={processQueue}
              disabled={isProcessing}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Start Processing
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export to Quartz Confirmation Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export {selectedRows.size} Contacts to Quartz?</DialogTitle>
            <DialogDescription>
              Export selected businesses to your Quartz/GoHighLevel CRM
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                📋 What will be exported:
              </p>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                <li><strong>Only businesses with phone OR email</strong></li>
                <li>Business name, address, phone, email, website</li>
                <li>Tagged as "QuartzIQ-Enrichment"</li>
                <li>Even if enrichment failed (as long as contact info exists)</li>
              </ul>
              <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  ℹ️ Businesses without phone AND email will be skipped
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsExportDialogOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="bg-gradient-to-r from-green-600 to-emerald-600"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Export {selectedRows.size} Contacts
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enrichment Dialog */}
      <Dialog open={enrichmentDialogOpen} onOpenChange={setEnrichmentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enrich Contact Information</DialogTitle>
            <DialogDescription>
              Find and enter contact details for {selectedBusiness?.business_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Business Info */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">{selectedBusiness?.business_name}</h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {selectedBusiness?.category && <div>Category: {selectedBusiness.category}</div>}
                {selectedBusiness?.address && <div>Address: {selectedBusiness.address}</div>}
                {selectedBusiness?.website && (
                  <div>
                    Website:{' '}
                    <a
                      href={selectedBusiness.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {selectedBusiness.website}
                    </a>
                  </div>
                )}
                {selectedBusiness?.va_notes && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <strong>VA Notes:</strong> {selectedBusiness.va_notes}
                  </div>
                )}
              </div>
            </div>

            {/* Contact Form */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="enrichment_source">Data Source</Label>
                <Select
                  value={formData.enrichment_source}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, enrichment_source: value })
                  }
                >
                  <SelectTrigger id="enrichment_source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Research</SelectItem>
                    <SelectItem value="apollo">Apollo.io</SelectItem>
                    <SelectItem value="apify">Apify</SelectItem>
                    <SelectItem value="multiple">Multiple Sources</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="confidence">Confidence ({formData.enrichment_confidence}%)</Label>
                <Input
                  id="confidence"
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={formData.enrichment_confidence}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      enrichment_confidence: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => setEnrichmentDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => saveEnrichment(false)}
                disabled={saving || !formData.email}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Progress
              </Button>
              <Button
                onClick={() => saveEnrichment(true)}
                disabled={
                  saving ||
                  !formData.first_name ||
                  !formData.last_name ||
                  !formData.email
                }
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Complete Enrichment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
