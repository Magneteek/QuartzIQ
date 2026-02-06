'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Users,
  Phone,
  Mail,
  Globe,
  MapPin,
  Building,
  Send,
  CheckCircle,
  Loader2,
  AlertCircle,
  Database,
  Sparkles,
  Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'

interface EnrichedBusiness {
  title: string
  address: string
  phone?: string
  email?: string
  website?: string
  url?: string
  placeId?: string
  contactEnriched?: boolean
  enrichmentDate?: Date
  ownerFirstName?: string
  ownerLastName?: string
  ownerTitle?: string
  ownerEmail?: string
  ownerEmailGenerated?: boolean
  reviewsForBusiness?: Array<{
    reviewUrl: string
    stars: number
    publishedAtDate: string
    text: string
  }>
}

interface LeadSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  enrichedBusinesses: EnrichedBusiness[]
  businessScrapedStatus: Record<string, boolean>
  selectedClientId: string
}

export function LeadSelectionModal({ isOpen, onClose, enrichedBusinesses, businessScrapedStatus, selectedClientId }: LeadSelectionModalProps) {
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendingAirtable, setSendingAirtable] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentAirtable, setSentAirtable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [includeScraped, setIncludeScraped] = useState(false)

  // Show businesses with qualifying reviews (already filtered by dashboard)
  // These businesses already have phone numbers from Google Maps
  const allAvailableLeads = enrichedBusinesses

  // Filter to show only NEW businesses by default (unless includeScraped is checked)
  const availableLeads = includeScraped
    ? allAvailableLeads
    : allAvailableLeads.filter(business => !businessScrapedStatus[business.placeId || ''])

  // Calculate counts
  const newLeadsCount = allAvailableLeads.filter(business => !businessScrapedStatus[business.placeId || '']).length
  const scrapedLeadsCount = allAvailableLeads.length - newLeadsCount

  // Calculate how many selected leads are NEW
  const selectedNewCount = Array.from(selectedLeads)
    .map(index => allAvailableLeads[parseInt(index)])
    .filter(business => business && !businessScrapedStatus[business.placeId || ''])
    .length

  useEffect(() => {
    if (isOpen) {
      // Pre-select only NEW businesses by default
      const newLeadIndices = allAvailableLeads
        .map((business, index) => ({ business, index }))
        .filter(({ business }) => !businessScrapedStatus[business.placeId || ''])
        .map(({ index }) => index.toString())

      setSelectedLeads(new Set(newLeadIndices))
      setSelectAll(false)
      setSent(false)
      setSentAirtable(false)
      setError(null)
      setIncludeScraped(false)
    }
  }, [isOpen, allAvailableLeads, businessScrapedStatus])

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedLeads(new Set(availableLeads.map((_, index) => index.toString())))
    } else {
      setSelectedLeads(new Set())
    }
  }

  const handleLeadSelect = (index: number, checked: boolean) => {
    const newSelected = new Set(selectedLeads)
    if (checked) {
      newSelected.add(index.toString())
    } else {
      newSelected.delete(index.toString())
    }
    setSelectedLeads(newSelected)
    setSelectAll(newSelected.size === availableLeads.length)
  }

  const handleSendToQuartzLeads = async () => {
    if (selectedLeads.size === 0) {
      setError('Please select at least one lead to send')
      return
    }

    setSending(true)
    setError(null)

    try {
      const selectedBusinesses = availableLeads.filter((_, index) =>
        selectedLeads.has(index.toString())
      )

      const response = await fetch('/api/quartz-leads/send-contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contacts: selectedBusinesses.map(business => ({
            name: business.title,
            address: business.address,
            phone: business.phone,
            email: business.email,
            website: business.website,
            source: 'QuartzIQ Review Extraction'
          })),
          clientId: selectedClientId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send contacts to Quartz Leads')
      }

      setSent(true)
      setTimeout(() => {
        onClose()
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send contacts')
    } finally {
      setSending(false)
    }
  }

  const handleSendToAirtable = async () => {
    if (selectedLeads.size === 0) {
      setError('Please select at least one lead to send')
      return
    }

    setSendingAirtable(true)
    setError(null)

    try {
      // Get Airtable credentials from localStorage
      const airtableApiKey = localStorage.getItem('airtable_api_key')
      const airtableBaseId = localStorage.getItem('airtable_base_id')
      const airtableTableName = localStorage.getItem('airtable_table_name') || 'Leads'

      if (!airtableApiKey || !airtableBaseId) {
        throw new Error('Airtable credentials not configured. Please check Settings.')
      }

      const selectedBusinesses = availableLeads.filter((_, index) =>
        selectedLeads.has(index.toString())
      )

      const response = await fetch('/api/airtable/send-contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contacts: selectedBusinesses.map(business => {
            // Get the first review (each business has one review)
            const review = business.reviewsForBusiness?.[0]

            return {
              name: business.title,
              address: business.address,
              phone: business.phone,
              email: business.email,
              website: business.website,
              url: business.url,
              source: 'QuartzIQ Review Extraction',
              ownerFirstName: business.ownerFirstName,
              ownerLastName: business.ownerLastName,
              ownerTitle: business.ownerTitle,
              ownerEmail: business.ownerEmail,
              ownerEmailGenerated: business.ownerEmailGenerated,
              // Review data
              reviewUrl: review?.reviewUrl,
              reviewStars: review?.stars,
              reviewDate: review?.publishedAtDate,
              reviewText: review?.text
            }
          }),
          airtableApiKey,
          airtableBaseId,
          airtableTableName
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send contacts to Airtable')
      }

      setSentAirtable(true)
      setTimeout(() => {
        onClose()
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send contacts to Airtable')
    } finally {
      setSendingAirtable(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-3">
                  <Users className="h-6 w-6 text-primary" />
                  <div>
                    <h2 className="text-xl font-semibold">Send Leads to CRM</h2>
                    <p className="text-sm text-muted-foreground">
                      Select businesses to send to Quartz Leads or Airtable (enrichment optional)
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Include Previously Scraped Toggle - Always show when there are scraped businesses */}
                {scrapedLeadsCount > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-dashed mb-6">
                    <Checkbox
                      checked={includeScraped}
                      onCheckedChange={(checked) => setIncludeScraped(checked as boolean)}
                    />
                    <label className="text-sm cursor-pointer flex-1" onClick={() => setIncludeScraped(!includeScraped)}>
                      Include previously exported businesses ({scrapedLeadsCount})
                    </label>
                    <Badge variant="outline" className="text-xs">
                      {includeScraped ? 'Showing all' : 'NEW only'}
                    </Badge>
                  </div>
                )}

                {availableLeads.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <h3 className="font-medium mb-2">No New Businesses to Export</h3>
                    <p className="text-sm text-muted-foreground">
                      All businesses with qualifying reviews have already been exported.
                      {allAvailableLeads.length > 0 && scrapedLeadsCount > 0 && (
                        <span className="block mt-2">Use the toggle above to see all {allAvailableLeads.length} businesses.</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Selection Controls */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectAll}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="rounded"
                          />
                          <span className="font-medium">
                            Select All ({selectedLeads.size}/{availableLeads.length} selected)
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                            <Sparkles className="h-3 w-3 mr-1" />
                            {newLeadsCount} NEW
                          </Badge>
                          {scrapedLeadsCount > 0 && (
                            <Badge variant="secondary" className="bg-gray-500/20 text-gray-400">
                              <Eye className="h-3 w-3 mr-1" />
                              {scrapedLeadsCount} SEEN
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Leads List */}
                    <div className="space-y-3">
                      {availableLeads.map((business, index) => {
                        const isSelected = selectedLeads.has(index.toString())

                        return (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <Card
                              className={cn(
                                "p-4 cursor-pointer transition-all duration-200",
                                isSelected
                                  ? 'ring-2 ring-primary bg-primary/5'
                                  : 'hover:bg-muted/50'
                              )}
                              onClick={() => handleLeadSelect(index, !isSelected)}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleLeadSelect(index, e.target.checked)}
                                  className="rounded mt-1"
                                  onClick={(e) => e.stopPropagation()}
                                />

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <h3 className="font-medium text-foreground">{business.title}</h3>
                                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        <span className="truncate">{business.address}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                      {businessScrapedStatus[business.placeId || ''] ? (
                                        <Badge variant="secondary" className="bg-gray-500/20 text-gray-400">
                                          <Eye className="h-3 w-3 mr-1" />
                                          SEEN
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                                          <Sparkles className="h-3 w-3 mr-1" />
                                          NEW
                                        </Badge>
                                      )}
                                      {(business.phone || business.email || business.website) && (
                                        <Badge variant="secondary">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Enriched
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {business.phone && (
                                      <div className="flex items-center gap-1 text-xs bg-green-500/10 text-green-300 px-2 py-1 rounded">
                                        <Phone className="h-3 w-3" />
                                        {business.phone}
                                      </div>
                                    )}
                                    {business.email && (
                                      <div className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-300 px-2 py-1 rounded">
                                        <Mail className="h-3 w-3" />
                                        {business.email}
                                      </div>
                                    )}
                                    {business.website && (
                                      <div className="flex items-center gap-1 text-xs bg-purple-500/10 text-purple-300 px-2 py-1 rounded">
                                        <Globe className="h-3 w-3" />
                                        Website
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </Card>
                          </motion.div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              {availableLeads.length > 0 && (
                <div className="border-t p-6">
                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm"
                    >
                      {error}
                    </motion.div>
                  )}

                  {/* Success Message */}
                  {(sent || sentAirtable) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300 text-sm"
                    >
                      <CheckCircle className="h-4 w-4 mr-2 inline" />
                      Successfully sent {selectedLeads.size} contacts to {sent ? 'Quartz Leads' : 'Airtable'}!
                    </motion.div>
                  )}

                  <div className="space-y-3">
                    {/* Modern Workflow Info */}
                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                      <p className="text-sm text-blue-300 font-medium mb-1">✅ Businesses Saved to Database</p>
                      <p className="text-xs text-muted-foreground">
                        Next: <strong>Leads</strong> page → Qualify → <strong>Enrichment</strong> → Export to Quartz
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={onClose}
                      >
                        Close
                      </Button>
                      <Button
                        onClick={() => window.location.href = '/dashboard/leads'}
                        className="flex-1"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Go to Leads Page
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}