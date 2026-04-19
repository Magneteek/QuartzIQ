'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Building, Link as LinkIcon, Sparkles, CheckCircle, Clock, AlertCircle } from 'lucide-react'

const businessSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  website: z.string().url('Invalid URL').or(z.literal('')).optional(),
  category: z.string().optional(),
  place_id: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  total_reviews: z.number().int().min(0).optional(),
  data_source: z.enum(['manual', 'scraper', 'import']).optional(),
  entry_method: z.enum(['manual_entry', 'google_maps_url', 'csv_import']).optional(),
  import_status: z.enum(['pending', 'completed', 'failed']).optional(),
  google_profile_url: z.string().url('Invalid URL').or(z.literal('')).optional(),
  google_maps_url: z.string().url('Invalid URL').or(z.literal('')).optional(),
  negative_review_url: z.string().url('Invalid URL').or(z.literal('')).optional(),
  va_notes: z.string().optional(),
  enrichment_priority: z.number().int().min(0).max(100).optional(),
})

type BusinessFormData = z.infer<typeof businessSchema>

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
  data_source: string
  entry_method: string | null
  import_status: string | null
  google_profile_url: string | null
  google_maps_url: string | null
  negative_review_url: string | null
  va_notes: string | null
  enrichment_priority: number | null
  lifecycle_stage?: string
  qualification_date?: string | null
  qualified_by_name?: string | null
  ready_for_enrichment?: boolean
  enrichment_status?: string | null
  review_count?: number
  latest_review_date?: string | null
  oldest_review_date?: string | null
  created_at?: string
  updated_at?: string
}

interface AddEditBusinessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead?: Lead | null
  onSuccess: () => void
}

export function AddEditBusinessDialog({
  open,
  onOpenChange,
  lead,
  onSuccess,
}: AddEditBusinessDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'manual_entry' | 'google_maps_url' | 'enrich'>('manual_entry')
  const [entryMethod, setEntryMethod] = useState<'manual_entry' | 'google_maps_url'>('manual_entry')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isEnriching, setIsEnriching] = useState(false)
  const [enrichMessage, setEnrichMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BusinessFormData>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      data_source: 'manual',
      entry_method: 'manual_entry',
      enrichment_priority: 50,
    },
  })

  const selectedDataSource = watch('data_source')

  // Populate form when editing
  useEffect(() => {
    if (lead) {
      setValue('business_name', lead.business_name)
      setValue('first_name', lead.first_name || '')
      setValue('last_name', lead.last_name || '')
      setValue('email', lead.email || '')
      setValue('phone', lead.phone || '')
      setValue('website', lead.website || '')
      setValue('category', lead.category || '')
      setValue('place_id', lead.place_id || '')
      setValue('address', lead.address || '')
      setValue('city', lead.city || '')
      setValue('country', lead.country || '')
      setValue('rating', lead.rating || undefined)
      setValue('total_reviews', lead.total_reviews || undefined)
      setValue('data_source', lead.data_source as any)
      setValue('entry_method', (lead.entry_method || 'manual_entry') as any)
      setValue('import_status', (lead.import_status || 'pending') as any)
      setValue('google_profile_url', lead.google_profile_url || '')
      setValue('negative_review_url', lead.negative_review_url || '')
      setValue('va_notes', lead.va_notes || '')
      setValue('enrichment_priority', lead.enrichment_priority || 50)
    } else {
      reset({
        data_source: 'manual',
        entry_method: 'manual_entry',
        import_status: 'pending',
        enrichment_priority: 50,
      })
    }
    setActiveTab('manual_entry')
    setEnrichMessage(null)
  }, [lead, setValue, reset])

  const handleQueueEnrichment = async () => {
    if (!lead) return
    setIsEnriching(true)
    setEnrichMessage(null)
    try {
      const res = await fetch(`/api/leads/${lead.id}/queue-enrichment`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to queue')
      setEnrichMessage('✅ Queued for enrichment successfully')
      onSuccess()
    } catch (err: any) {
      setEnrichMessage(`❌ ${err.message}`)
    } finally {
      setIsEnriching(false)
    }
  }

  // Extract place_id from Google Maps URL
  const [isExtracting, setIsExtracting] = useState(false)

  const handleGoogleMapsUrl = async () => {
    if (!googleMapsUrl.trim()) {
      alert('Please enter a Google Maps URL')
      return
    }

    setIsExtracting(true)

    try {
      const response = await fetch('/api/leads/extract-google-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: googleMapsUrl }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract business details')
      }

      // Populate form with extracted details
      const { details } = data
      setValue('business_name', details.business_name)
      setValue('place_id', details.place_id)
      setValue('address', details.address)
      setValue('city', details.city)
      setValue('country', details.country)
      setValue('phone', details.phone)
      setValue('website', details.website)
      setValue('rating', details.rating)
      setValue('total_reviews', details.total_reviews)
      setValue('category', details.category)
      setValue('google_profile_url', details.google_profile_url)
      setValue('google_maps_url', details.google_maps_url) // Set both for compatibility
      setValue('entry_method', 'google_maps_url')

      alert('✅ Business details extracted successfully!')
    } catch (error: any) {
      console.error('Error extracting Google Maps data:', error)

      // Show detailed error message
      const errorMessage = error.message || 'Unknown error occurred'
      alert(`❌ Failed to extract business details:\n\n${errorMessage}\n\nTip: Make sure you're using the full Google Maps URL, not a shortened link.`)
    } finally {
      setIsExtracting(false)
    }
  }

  const onSubmit = async (data: BusinessFormData) => {
    setIsSubmitting(true)
    setErrorMessage(null) // Clear previous errors

    try {
      const url = lead ? `/api/leads/${lead.id}` : '/api/leads'
      const method = lead ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          lifecycle_stage: 'lead', // Always set as 'lead' for Stage 1
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Handle duplicate business error
        if (response.status === 409 && errorData.isDuplicate) {
          setErrorMessage(
            `⚠️ Duplicate Business: ${errorData.details || errorData.error}\n\n` +
            (errorData.suggestion || 'Please check if this business already exists in the Lead Qualification list.')
          )
          setIsSubmitting(false)
          return
        }

        // Handle other errors with details
        const errorMsg = errorData.details || errorData.error || 'Failed to save business'
        throw new Error(errorMsg)
      }

      // Success - close dialog and reset
      setErrorMessage(null)
      onSuccess()
      onOpenChange(false)
      reset()
    } catch (error: any) {
      console.error('Error saving business:', error)
      setErrorMessage(`❌ Failed to save business: ${error.message || 'An unexpected error occurred'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            {lead ? 'Edit Business' : 'Add New Business'}
          </DialogTitle>
          <DialogDescription>
            {lead
              ? 'Update business information and qualification notes'
              : 'Enter business details manually or from Google Maps URL'}
          </DialogDescription>
        </DialogHeader>

        {/* Error Message Display */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="text-sm whitespace-pre-line">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Entry Method Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as any)
              if (v === 'manual_entry' || v === 'google_maps_url') setEntryMethod(v as any)
            }}
            className="w-full"
          >
            <TabsList className={`grid w-full ${lead ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="manual_entry">
                <Building className="h-4 w-4 mr-2" />
                Manual Entry
              </TabsTrigger>
              <TabsTrigger value="google_maps_url">
                <LinkIcon className="h-4 w-4 mr-2" />
                Google Maps URL
              </TabsTrigger>
              {lead && (
                <TabsTrigger value="enrich">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Enrich
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="google_maps_url" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Google Maps URL</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://www.google.com/maps/place/..."
                    value={googleMapsUrl}
                    onChange={(e) => setGoogleMapsUrl(e.target.value)}
                    disabled={isExtracting}
                  />
                  <Button
                    type="button"
                    onClick={handleGoogleMapsUrl}
                    disabled={isExtracting || !googleMapsUrl.trim()}
                  >
                    {isExtracting ? 'Scraping...' : 'Extract'}
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Paste a Google Maps URL to automatically fill in business details
                </p>
              </div>
            </TabsContent>

            {lead && (
              <TabsContent value="enrich" className="mt-4">
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {lead.enrichment_status === 'completed' ? (
                        <><CheckCircle className="h-4 w-4 text-green-600" /><span className="text-green-700 font-medium">Enrichment complete</span></>
                      ) : lead.enrichment_status === 'in_progress' ? (
                        <><Clock className="h-4 w-4 text-yellow-600" /><span className="text-yellow-700 font-medium">Enrichment in progress</span></>
                      ) : lead.ready_for_enrichment ? (
                        <><Clock className="h-4 w-4 text-blue-600" /><span className="text-blue-700 font-medium">Queued for enrichment</span></>
                      ) : (
                        <><AlertCircle className="h-4 w-4 text-gray-400" /><span className="text-gray-500">Not yet enriched</span></>
                      )}
                    </div>
                    {lead.email && <p className="text-sm"><span className="text-gray-500">Email:</span> {lead.email}</p>}
                    {lead.first_name && <p className="text-sm"><span className="text-gray-500">Contact:</span> {lead.first_name} {lead.last_name}</p>}
                  </div>

                  {enrichMessage && (
                    <p className="text-sm font-medium">{enrichMessage}</p>
                  )}

                  <Button
                    type="button"
                    onClick={handleQueueEnrichment}
                    disabled={isEnriching}
                    className="w-full"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isEnriching ? 'Queuing...' : 'Queue for Enrichment'}
                  </Button>
                  <p className="text-xs text-gray-500 text-center">
                    Runs the enrichment pipeline: website scrape → owner name → email lookup
                  </p>
                </div>
              </TabsContent>
            )}
          </Tabs>

          {/* Business Details */}
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">
                Business Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="business_name"
                {...register('business_name')}
                disabled={isSubmitting}
                placeholder="e.g., Joe's Pizza"
              />
              {errors.business_name && (
                <p className="text-sm text-red-600">{errors.business_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Business Category</Label>
              <Input
                id="category"
                {...register('category')}
                disabled={isSubmitting}
                placeholder="e.g., Restaurant, Dental Clinic, Law Firm"
              />
            </div>

            {/* Contact Information */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Contact Information</h4>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    {...register('first_name')}
                    disabled={isSubmitting}
                    placeholder="John"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    {...register('last_name')}
                    disabled={isSubmitting}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  disabled={isSubmitting}
                  placeholder="contact@business.com"
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register('city')} disabled={isSubmitting} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  {...register('country')}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" {...register('address')} disabled={isSubmitting} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register('phone')} disabled={isSubmitting} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  {...register('website')}
                  disabled={isSubmitting}
                />
                {errors.website && (
                  <p className="text-sm text-red-600">{errors.website.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rating">Rating (0-5)</Label>
                <Input
                  id="rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  {...register('rating', { valueAsNumber: true })}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_reviews">Total Reviews</Label>
                <Input
                  id="total_reviews"
                  type="number"
                  min="0"
                  {...register('total_reviews', { valueAsNumber: true })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* URLs */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Review & Profile URLs</h4>

              <div className="space-y-2 mb-4">
                <Label htmlFor="google_profile_url">Google Profile URL</Label>
                <Input
                  id="google_profile_url"
                  type="url"
                  {...register('google_profile_url')}
                  disabled={isSubmitting}
                  placeholder="https://www.google.com/maps/place/..."
                />
                {errors.google_profile_url && (
                  <p className="text-sm text-red-600">
                    {errors.google_profile_url.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="negative_review_url">Negative Review URL</Label>
                <Input
                  id="negative_review_url"
                  type="url"
                  {...register('negative_review_url')}
                  disabled={isSubmitting}
                  placeholder="https://www.google.com/maps/contrib/..."
                />
                {errors.negative_review_url && (
                  <p className="text-sm text-red-600">
                    {errors.negative_review_url.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_source">Data Source</Label>
                <Select
                  value={selectedDataSource}
                  onValueChange={(value) => setValue('data_source', value as any)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="scraper">Scraper</SelectItem>
                    <SelectItem value="import">Import</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="import_status">Import Status</Label>
                <Select
                  value={watch('import_status')}
                  onValueChange={(value) => setValue('import_status', value as any)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enrichment_priority">
                  Priority (0-100)
                </Label>
                <Input
                  id="enrichment_priority"
                  type="number"
                  min="0"
                  max="100"
                  {...register('enrichment_priority', { valueAsNumber: true })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="va_notes">VA Notes</Label>
              <Textarea
                id="va_notes"
                rows={3}
                placeholder="Add qualification notes, observations, or special instructions..."
                {...register('va_notes')}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="place_id">
                Google Place ID{' '}
                <span className="text-sm text-gray-500">(auto-extracted)</span>
              </Label>
              <Input
                id="place_id"
                {...register('place_id')}
                disabled={isSubmitting}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : lead ? 'Update Business' : 'Add Business'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
